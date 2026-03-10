"""
M3 – Batch Scoring + M4 Threshold Calibration
Compute anomaly scores on all sessions, calibrate thresholds, export CSV.

Usage:
  python score_batch.py [--config config.yaml] [--split test]
"""

import os
import json
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import torch.nn.functional as F
import yaml

from train import LSTMNextEventModel, load_config, set_seed


# ── Scoring ──────────────────────────────────────────────────────────────────

@torch.no_grad()
def score_windows(model, X, device, batch_size=256):
    """
    Compute step anomaly scores: s(t) = -log P(true_next | history)
    Returns: (N, L-1) array of step scores
    """
    model.eval()
    all_scores = []
    for i in range(0, len(X), batch_size):
        batch = torch.tensor(X[i:i+batch_size], dtype=torch.long).to(device)
        logits = model(batch[:, :-1])          # (B, L-1, V)
        targets = batch[:, 1:]                 # (B, L-1)  – true next events
        log_probs = F.log_softmax(logits, dim=-1)  # (B, L-1, V)
        # Gather log prob of true next event
        step_scores = -log_probs.gather(
            dim=2,
            index=targets.unsqueeze(-1)
        ).squeeze(-1).cpu().numpy()            # (B, L-1)
        all_scores.append(step_scores)
    return np.concatenate(all_scores, axis=0)


def compute_window_scores(step_scores, mode='mean'):
    """Aggregate step scores → window score."""
    if mode == 'mean':
        return step_scores.mean(axis=1)
    elif mode == 'max':
        return step_scores.max(axis=1)
    return step_scores.mean(axis=1)


def compute_ema(scores, alpha=0.3):
    """
    Apply EMA over windows for a single session's window scores.
    R_t = alpha * R_{t-1} + (1 - alpha) * S_window
    """
    ema = np.zeros_like(scores)
    ema[0] = scores[0]
    for t in range(1, len(scores)):
        ema[t] = alpha * ema[t-1] + (1 - alpha) * scores[t]
    return ema


# ── Calibration ───────────────────────────────────────────────────────────────

def calibrate_thresholds(normal_scores, warn_pct=99.0, block_pct=99.9):
    """Compute P99 and P99.9 from normal session window scores."""
    T_warn  = float(np.percentile(normal_scores, warn_pct))
    T_block = float(np.percentile(normal_scores, block_pct))
    print(f"[Calibrate] T_warn (P{warn_pct}) = {T_warn:.4f}")
    print(f"[Calibrate] T_block (P{block_pct}) = {T_block:.4f}")
    return T_warn, T_block


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='config.yaml')
    parser.add_argument('--split', default='test', choices=['train', 'val', 'test'])
    args = parser.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get('seed', 42))

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[Score] Device: {device}")

    data_dir  = Path(cfg['artifacts']['dataset_dir'])
    model_dir = Path(cfg['artifacts']['model_dir'])
    report_dir = Path(cfg['artifacts']['report_dir'])
    report_dir.mkdir(parents=True, exist_ok=True)

    # Load model
    mcfg = cfg['model']
    model = LSTMNextEventModel(
        vocab_size=mcfg['vocab_size'],
        embedding_dim=mcfg['embedding_dim'],
        hidden_size=mcfg['lstm_hidden'],
        num_layers=mcfg['lstm_layers'],
        dropout=mcfg['dropout'],
    ).to(device)
    model.load_state_dict(torch.load(model_dir / 'best_model.pt', map_location=device))
    print(f"[Score] Loaded model from {model_dir}/best_model.pt")

    # Load dataset
    data = np.load(data_dir / f'dataset_{args.split}.npz', allow_pickle=True)
    X = data['X_events']         # (N, L-1)
    session_ids = data.get('session_ids', np.array(['unknown'] * len(X)))

    print(f"[Score] Scoring {len(X)} windows from {args.split} split...")
    step_scores = score_windows(model, X, device)   # (N, L-1)

    scfg = cfg['scoring']
    window_scores = compute_window_scores(step_scores, mode=scfg['score_fn'])  # (N,)

    # ── Check if labels present (synthetic data) ──────────────────────────
    has_labels = 'labels' in data.files
    labels = data['labels'].astype(int) if has_labels else None
    normal_scores = window_scores[labels == 0] if has_labels else window_scores
    attack_scores = window_scores[labels == 1] if has_labels else np.array([])

    if has_labels:
        print(f"[Score] Normal windows: {(labels==0).sum()} | Attack windows: {(labels==1).sum()}")

    # Calibrate on NORMAL scores only (P99 / P99.9)
    pcfg = cfg['policy']
    T_warn, T_block = calibrate_thresholds(
        normal_scores,
        warn_pct=pcfg['warn_percentile'],
        block_pct=pcfg['block_percentile'],
    )

    # FPR and Detection Rate when labels available
    if has_labels and len(attack_scores) > 0:
        fpr_warn  = float((normal_scores > T_warn).mean())
        fpr_block = float((normal_scores > T_block).mean())
        dr_warn   = float((attack_scores > T_warn).mean())
        dr_block  = float((attack_scores > T_block).mean())
        print(f"[Score] FPR@T_warn={fpr_warn:.3f}  DR@T_warn={dr_warn:.3f}")
        print(f"[Score] FPR@T_block={fpr_block:.4f}  DR@T_block={dr_block:.3f}")

    # Assign decisions
    alpha = pcfg['ema_alpha']
    decisions = []
    for score in window_scores:
        if score > T_block:
            decisions.append('REVOKE_CANDIDATE')
        elif score > T_warn:
            decisions.append('WARN')
        else:
            decisions.append('NONE')

    # Export CSV
    import pandas as pd
    df_out = pd.DataFrame({
        'session_id':   session_ids,
        'window_score': window_scores.round(4),
        'decision':     decisions,
        'T_warn':       T_warn,
        'T_block':      T_block,
    })

    out_path = report_dir / f'batch_scores_{args.split}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
    df_out.to_csv(out_path, index=False)
    print(f"[Score] Saved {len(df_out)} rows → {out_path}")

    # Save thresholds for TypeScript policy engine
    thresholds = {
        'T_warn': T_warn,
        'T_block': T_block,
        'ema_alpha': alpha,
        'warn_percentile': pcfg['warn_percentile'],
        'block_percentile': pcfg['block_percentile'],
        'calibrated_at': datetime.utcnow().isoformat(),
        'n_samples': int(len(window_scores)),
    }
    with open(model_dir / 'thresholds.json', 'w') as f:
        json.dump(thresholds, f, indent=2)
    print(f"[Score] Thresholds saved → {model_dir}/thresholds.json")
    print(f"[Score] → Copy these to lib/policy-engine.ts DEFAULT_POLICY")

if __name__ == '__main__':
    main()
