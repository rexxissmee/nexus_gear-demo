"""
M3 – Batch Scoring + Threshold Calibration (Supervised)
Compute anomaly scores on all sessions, calibrate thresholds based on F1/Precision, export CSV.

Usage:
  python score_batch.py [--config config.yaml] [--split val]
"""

import os
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader
import yaml

from train import SessionDataset, LSTMSupervisedModel, load_config, set_seed
from sklearn.metrics import precision_score, recall_score, f1_score

# ── Calibration ───────────────────────────────────────────────────────────────

def threshold_sweep(y_true, y_score, n_points: int = 100):
    thresholds = np.linspace(0.01, 0.99, n_points)
    rows = []
    for t in thresholds:
        y_pred = (y_score >= t).astype(int)
        prec = float(precision_score(y_true, y_pred, pos_label=1, zero_division=0))
        rec  = float(recall_score(y_true, y_pred, pos_label=1, zero_division=0))
        f1   = float(f1_score(y_true, y_pred, pos_label=1, zero_division=0))
        rows.append({'threshold': t, 'precision': prec, 'recall': rec, 'f1': f1})
    return pd.DataFrame(rows)

def calibrate_supervised_thresholds(y_true, y_score):
    """
    Calibrate Step-Up and Revoke thresholds optimally:
    - REVOKE: Maximize Precision while keeping decent Recall (e.g. target Precision >= 0.95 or max F1 if not possible)
    - STEP_UP: Maximize F1, or target high Recall (e.g. Recall >= 0.90)
    """
    df = threshold_sweep(y_true, y_score, 200)
    
    # 1. Calibrate Revoke (High Precision Mode)
    # Try to find threshold where Precision >= 0.95
    high_prec = df[df['precision'] >= 0.95]
    if len(high_prec) > 0:
        # Get the one with max recall among those that give >= 0.95 precision
        best_revoke = high_prec.loc[high_prec['recall'].idxmax()]
        T_revoke = best_revoke['threshold']
    else:
        # Fallback: Just max F1
        best_revoke = df.loc[df['f1'].idxmax()]
        T_revoke = best_revoke['threshold']

    # 2. Calibrate Step-up (High Recall/Max F1 Mode)
    # Find max F1
    best_f1 = df.loc[df['f1'].idxmax()]
    T_step_up = best_f1['threshold']
    
    # Ensure step_up <= revoke
    if T_step_up > T_revoke:
        T_step_up = T_revoke - 0.05
        
    print(f"[Calibrate] T_step_up = {T_step_up:.4f} (Max F1)")
    print(f"[Calibrate] T_revoke  = {T_revoke:.4f} (High Precision)")
    
    return float(T_step_up), float(T_revoke)

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='config.yaml')
    parser.add_argument('--split', default='val', choices=['train', 'val', 'test'])
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
    model = LSTMSupervisedModel(
        vocab_size    = mcfg['vocab_size'],
        embedding_dim = mcfg['embedding_dim'],
        extra_dim     = mcfg.get('extra_dim', 9),  # matching train.py standard
        hidden_size   = mcfg['lstm_hidden'],
        num_layers    = mcfg['lstm_layers'],
        dropout       = 0.0,
    ).to(device)
    
    model_path = model_dir / 'best_model.pt'
    ckpt = torch.load(model_path, map_location=device, weights_only=False)
    state_dict = ckpt.get('model_state_dict', ckpt)
    model.load_state_dict(state_dict)
    model.eval()
    print(f"[Score] Loaded model from {model_path}")

    # Load dataset
    ds_path = data_dir / f'dataset_{args.split}.npz'
    ds = SessionDataset(ds_path)
    loader = DataLoader(ds, batch_size=256, shuffle=False)
    
    data = np.load(ds_path, allow_pickle=True)
    session_ids = data.get('session_ids', np.array(['unknown'] * len(ds)))
    has_labels = 'y' in data.files
    y_true = np.array(data['y']) if has_labels else None

    print(f"[Score] Scoring {len(ds)} windows from {args.split} split...")
    
    all_preds = []
    with torch.no_grad():
        for X_ev, X_dt, X_flags, X_metrics, _ in loader:
            X_ev   = X_ev.to(device)
            x_cont = torch.cat([X_dt.to(device), X_flags.to(device), X_metrics.to(device)], dim=-1)
            logits = model(X_ev, x_cont)
            probs  = torch.sigmoid(logits).cpu().numpy()
            all_preds.extend(probs)
            
    window_scores = np.array(all_preds)

    # ── Calibration ────────────────────────────────────────────────────────
    
    if has_labels and len(np.unique(y_true)) > 1:
        # Calibrate supervised thresholds
        T_step_up, T_revoke = calibrate_supervised_thresholds(y_true, window_scores)
        thr_source = "calibrated_supervised"
    else:
        print("[Score] No valid labels found to perform supervised calibration. Using defaults.")
        T_step_up, T_revoke = 0.30, 0.50
        thr_source = "default"

    # Assign decisions
    decisions = []
    for score in window_scores:
        if score >= T_revoke:
            decisions.append('REVOKE')
        elif score >= T_step_up:
            decisions.append('STEP_UP')
        else:
            decisions.append('NONE')

    # Export CSV
    df_out = pd.DataFrame({
        'session_id':   session_ids,
        'window_score': window_scores.round(4),
        'decision':     decisions,
        'T_step_up':    round(T_step_up, 4),
        'T_revoke':     round(T_revoke, 4),
    })

    if has_labels:
        df_out['label'] = y_true

    out_path = report_dir / f'batch_scores_{args.split}_{datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")}.csv'
    df_out.to_csv(out_path, index=False)
    print(f"[Score] Saved {len(df_out)} rows → {out_path}")

    # Save thresholds for TypeScript policy engine
    thresholds = {
        'step_up': round(T_step_up, 4),
        'revoke': round(T_revoke, 4),
        'calibrated': True if has_labels else False,
        'source': thr_source,
        'calibrated_at': datetime.now(timezone.utc).isoformat(),
        'n_samples': int(len(window_scores)),
    }
    
    thresholds_path = model_dir / 'thresholds.json'
    with open(thresholds_path, 'w') as f:
        json.dump(thresholds, f, indent=2)
    print(f"[Score] Thresholds saved → {thresholds_path}")
    print(f"[Score] → These thresholds will now be used by the ml/evaluate.py and TS policy engine.")

if __name__ == '__main__':
    main()
