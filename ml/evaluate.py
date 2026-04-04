"""
M5 – Supervised Evaluation Script
Computes for both LSTM and Rule-Based models:
  - Confusion matrix (per-class precision/recall/f1)
  - ROC-AUC, PR-AUC
  - Precision/Recall for class 1 (ATTACK)
  - Threshold sweep (precision/recall vs threshold on predict_proba)
  - Side-by-side comparison JSON

Outputs saved to artifacts/reports/:
  metrics_test.json            – LSTM metrics (read by Admin dashboard)
  metrics_rule_based.json      – Rule-Based metrics
  comparison_lstm_vs_rule.json – combined + delta
  predictions.csv
  confusion_matrix_lstm.png
  confusion_matrix_rule.png
  comparison_roc.png
  pr_curve.png
  threshold_sweep.png

Usage:
  python evaluate.py [--config config.yaml]
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_auc_score, average_precision_score,
    f1_score, precision_score, recall_score,
    confusion_matrix, ConfusionMatrixDisplay,
    roc_curve, precision_recall_curve,
    classification_report,
)
import yaml

from train import SessionDataset, LSTMSupervisedModel, load_config


# ── Helpers ───────────────────────────────────────────────────────────────────

def styled_cm(cm: np.ndarray, labels, title: str, save_path: Path):
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)
    fig, ax = plt.subplots(figsize=(5, 4))
    disp.plot(cmap='Blues', values_format='d', ax=ax, colorbar=False)
    ax.set_title(title, fontsize=11, pad=10)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close(fig)


def per_class_metrics(y_true, y_pred, y_score) -> dict:
    """Returns detailed metrics for both classes and the attack class specifically."""
    roc_auc = roc_auc_score(y_true, y_score) if len(np.unique(y_true)) > 1 else 0.0
    pr_auc  = average_precision_score(y_true, y_score) if len(np.unique(y_true)) > 1 else 0.0
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    prec1 = precision_score(y_true, y_pred, pos_label=1, zero_division=0)
    rec1  = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
    f1_1  = f1_score(y_true, y_pred, pos_label=1, zero_division=0)

    prec0 = precision_score(y_true, y_pred, pos_label=0, zero_division=0)
    rec0  = recall_score(y_true, y_pred, pos_label=0, zero_division=0)
    f1_0  = f1_score(y_true, y_pred, pos_label=0, zero_division=0)

    fpr_val = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    fnr_val = fn / (fn + tp) if (fn + tp) > 0 else 0.0

    n_attack = int(y_true.sum())
    n_normal = int(len(y_true) - n_attack)

    return {
        'roc_auc':  round(float(roc_auc), 4),
        'pr_auc':   round(float(pr_auc),  4),
        'f1_macro': round(float(f1_score(y_true, y_pred, average='macro', zero_division=0)), 4),
        # Class 1 – ATTACK
        'precision_attack': round(float(prec1), 4),
        'recall_attack':    round(float(rec1), 4),
        'f1_attack':        round(float(f1_1), 4),
        # Class 0 – NORMAL
        'precision_normal': round(float(prec0), 4),
        'recall_normal':    round(float(rec0), 4),
        'f1_normal':        round(float(f1_0), 4),
        # Legacy aliases (Admin UI reads these)
        'f1_score':   round(float(f1_1), 4),
        'precision':  round(float(prec1), 4),
        'recall':     round(float(rec1), 4),
        'fpr':        round(float(fpr_val), 4),
        'fnr':        round(float(fnr_val), 4),
        'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp),
        'n_test_samples': int(len(y_true)),
        'n_attack': n_attack,
        'n_normal': n_normal,
    }


def threshold_sweep(y_true, y_score, n_points: int = 100) -> list[dict]:
    """Compute precision/recall/f1 at each threshold percentile."""
    thresholds = np.linspace(0.0, 1.0, n_points)
    rows = []
    for t in thresholds:
        y_pred = (y_score >= t).astype(int)
        prec = float(precision_score(y_true, y_pred, pos_label=1, zero_division=0))
        rec  = float(recall_score(y_true, y_pred, pos_label=1, zero_division=0))
        f1   = float(f1_score(y_true, y_pred, pos_label=1, zero_division=0))
        rows.append({'threshold': round(float(t), 4), 'precision': round(prec, 4),
                     'recall': round(rec, 4), 'f1': round(f1, 4)})
    return rows


def plot_pr_curves(y_true, scores_dict: dict, save_path: Path):
    """Plot PR curves for multiple models on one chart."""
    fig, ax = plt.subplots(figsize=(7, 5))
    colors = {'LSTM': 'steelblue', 'Rule-Based': 'darkorange'}
    for name, y_score in scores_dict.items():
        prec_vals, rec_vals, _ = precision_recall_curve(y_true, y_score)
        pr_auc = average_precision_score(y_true, y_score)
        ax.plot(rec_vals, prec_vals, label=f'{name} (PR-AUC={pr_auc:.3f})',
                color=colors.get(name, 'green'), lw=2)
    no_skill = float(y_true.sum()) / len(y_true)
    ax.axhline(no_skill, color='gray', linestyle='--', label=f'No Skill ({no_skill:.2f})')
    ax.set_xlabel('Recall (Class 1 = ATTACK)')
    ax.set_ylabel('Precision (Class 1 = ATTACK)')
    ax.set_title('Precision-Recall Curve — LSTM vs Rule-Based')
    ax.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close(fig)


def plot_roc_curves(y_true, scores_dict: dict, save_path: Path):
    fig, ax = plt.subplots(figsize=(7, 5))
    colors = {'LSTM': 'steelblue', 'Rule-Based': 'darkorange'}
    for name, y_score in scores_dict.items():
        fpr_c, tpr_c, _ = roc_curve(y_true, y_score)
        auc = roc_auc_score(y_true, y_score)
        ax.plot(fpr_c, tpr_c, label=f'{name} (AUC={auc:.3f})',
                color=colors.get(name, 'green'), lw=2)
    ax.plot([0, 1], [0, 1], '--', color='gray', label='Random')
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title('ROC Curve — LSTM vs Rule-Based')
    ax.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close(fig)


def plot_threshold_sweep(sweep_rows: list, model_name: str, save_path: Path, step_up_thr: float = None):
    df = pd.DataFrame(sweep_rows)
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(df['threshold'], df['precision'], label='Precision (ATTACK)', color='steelblue', lw=1.5)
    ax.plot(df['threshold'], df['recall'],    label='Recall (ATTACK)',    color='darkorange', lw=1.5)
    ax.plot(df['threshold'], df['f1'],        label='F1 (ATTACK)',       color='green', lw=1.5, linestyle='--')
    if step_up_thr is not None:
        ax.axvline(step_up_thr, color='red', linestyle=':', linewidth=1.5, label=f'STEP_UP thr={step_up_thr:.2f}')
    ax.set_xlabel('Decision Threshold (predict_proba ≥ t → ATTACK)')
    ax.set_ylabel('Score')
    ax.set_title(f'{model_name} – Precision / Recall / F1 vs Threshold')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    ax.legend()
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close(fig)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='config.yaml')
    args = parser.parse_args()

    cfg = load_config(args.config)
    report_dir = Path(cfg.get('artifacts', {}).get('report_dir', 'artifacts/reports'))
    model_dir  = Path(cfg.get('artifacts', {}).get('model_dir',  'artifacts/models'))
    data_dir   = Path(cfg.get('artifacts', {}).get('dataset_dir', 'artifacts/datasets'))
    report_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    # ── Load test dataset ────────────────────────────────────────────────────
    test_ds_path = data_dir / 'dataset_test.npz'
    if not test_ds_path.exists():
        print(f"ERROR: Test dataset not found at {test_ds_path}")
        return

    test_ds = SessionDataset(test_ds_path)
    test_loader = DataLoader(test_ds, batch_size=128, shuffle=False)

    # ── Load calibrated thresholds ───────────────────────────────────────────
    thresholds_path = model_dir / 'thresholds.json'
    if thresholds_path.exists():
        with open(thresholds_path) as f:
            thr_data = json.load(f)
        step_up_thr = float(thr_data.get('step_up', 0.45))
        revoke_thr  = float(thr_data.get('revoke',  0.75))
        thr_source  = 'calibrated' if thr_data.get('calibrated') else 'default'
    else:
        step_up_thr, revoke_thr, thr_source = 0.45, 0.75, 'default'
    print(f"[Evaluate] Thresholds ({thr_source}): step_up={step_up_thr}, revoke={revoke_thr}")

    # ── LSTM inference ────────────────────────────────────────────────────────
    mcfg = cfg['model']
    model = LSTMSupervisedModel(
        vocab_size    = mcfg['vocab_size'],
        embedding_dim = mcfg['embedding_dim'],
        extra_dim     = mcfg.get('extra_dim', 9),
        hidden_size   = mcfg['lstm_hidden'],
        num_layers    = mcfg['lstm_layers'],
        dropout       = 0.0,
    ).to(device)

    model_path = model_dir / 'best_model.pt'
    if not model_path.exists():
        print(f"ERROR: Model not found at {model_path}")
        return

    ckpt = torch.load(model_path, map_location=device, weights_only=False)
    state_dict = ckpt.get('model_state_dict', ckpt)
    model.load_state_dict(state_dict)
    model.eval()

    all_preds, all_labels = [], []
    print("[Evaluate] Running LSTM inference on test set...")
    with torch.no_grad():
        for X_ev, X_dt, X_flags, X_metrics, y in test_loader:
            X_ev    = X_ev.to(device)
            x_cont  = torch.cat([X_dt.to(device), X_flags.to(device), X_metrics.to(device)], dim=-1)
            logits  = model(X_ev, x_cont)
            probs   = torch.sigmoid(logits).cpu().numpy()
            all_preds.extend(probs)
            all_labels.extend(y.numpy())

    y_score = np.array(all_preds)
    y_true  = np.array(all_labels)

    # ── LSTM metrics ─────────────────────────────────────────────────────────
    y_pred_lstm = (y_score >= step_up_thr).astype(int)
    lstm_m = per_class_metrics(y_true, y_pred_lstm, y_score)
    lstm_m.update({
        'threshold_step_up': step_up_thr,
        'threshold_revoke':  revoke_thr,
        'threshold_source':  thr_source,
        'evaluated_at':      datetime.now(timezone.utc).isoformat(),
    })

    print("\n=== LSTM Evaluation Results ===")
    for k, v in lstm_m.items():
        print(f"  {k}: {v}")

    # Confusion matrix – LSTM
    cm_lstm = confusion_matrix(y_true, y_pred_lstm, labels=[0, 1])
    styled_cm(cm_lstm, ['NORMAL', 'ATTACK'],
              f'LSTM Confusion Matrix (threshold={step_up_thr})',
              report_dir / 'confusion_matrix_lstm.png')

    # Threshold sweep – LSTM
    lstm_sweep = threshold_sweep(y_true, y_score)
    plot_threshold_sweep(lstm_sweep, 'LSTM',
                         report_dir / 'threshold_sweep_lstm.png',
                         step_up_thr=step_up_thr)

    # ── Rule-Based scores ─────────────────────────────────────────────────────
    rule_scores = None
    try:
        test_ds_data = np.load(test_ds_path)
        X_flags_all  = test_ds_data['X_flags']    # (N, T, F)
        flag_max     = X_flags_all.max(axis=1)     # (N, F)

        WEIGHTS  = np.array([2.0, 1.5, 2.5, 1.5, 0.0])     # ip, ua, dev, geo, cookie
        MAX_RULE = 13.0
        raw = (flag_max[:, :len(WEIGHTS)] * WEIGHTS[:flag_max.shape[1]]).sum(axis=1)

        # Decode event types for 401/403/burst/sensitive bonus
        X_ev_all  = test_ds_data['X_events']
        vocab_path = Path('vocab.json')
        if vocab_path.exists():
            with open(vocab_path) as vf:
                vocab_rb = json.load(vf)
            status_401_id = vocab_rb.get('STATUS_401', -1)
            status_403_id = vocab_rb.get('STATUS_403', -1)
            req_burst_id  = vocab_rb.get('REQUEST_BURST', -1)
            api_sensitive_id = vocab_rb.get('API_CALL_SENSITIVE', -1)
            raw += (X_ev_all == status_401_id).any(axis=1).astype(float) * 1.0
            raw += (X_ev_all == status_403_id).any(axis=1).astype(float) * 1.2
            raw += (X_ev_all == req_burst_id).any(axis=1).astype(float)  * 1.8
            raw += (X_ev_all == api_sensitive_id).any(axis=1).astype(float) * 1.5

        rule_scores = np.clip(raw / MAX_RULE, 0.0, 1.0)
        print("[Evaluate] Rule-Based scores computed.")
    except Exception as e:
        print(f"[Evaluate] Rule-Based score computation skipped: {e}")

    # ── Rule-Based metrics ────────────────────────────────────────────────────
    rb_m = None
    rb_sweep = None
    if rule_scores is not None and len(np.unique(y_true)) > 1:
        # Rule-based score and thresholds are scaled differently from LSTM
        rb_step_up_thr = 0.30
        rb_revoke_thr  = 0.55
        y_pred_rb = (rule_scores >= rb_step_up_thr).astype(int)
        rb_m = per_class_metrics(y_true, y_pred_rb, rule_scores)
        rb_m.update({'threshold_step_up': rb_step_up_thr, 'threshold_revoke': rb_revoke_thr, 'evaluated_at': datetime.now(timezone.utc).isoformat()})

        print("\n=== Rule-Based Evaluation Results ===")
        for k, v in rb_m.items():
            print(f"  {k}: {v}")

        # Confusion matrix – Rule-Based
        cm_rb = confusion_matrix(y_true, y_pred_rb, labels=[0, 1])
        styled_cm(cm_rb, ['NORMAL', 'ATTACK'],
                  f'Rule-Based Confusion Matrix (threshold={rb_step_up_thr})',
                  report_dir / 'confusion_matrix_rule.png')

        # Threshold sweep – Rule-Based
        rb_sweep = threshold_sweep(y_true, rule_scores)
        plot_threshold_sweep(rb_sweep, 'Rule-Based',
                             report_dir / 'threshold_sweep_rule.png',
                             step_up_thr=rb_step_up_thr)

        # Delta
        delta = {k: round(float(lstm_m[k]) - float(rb_m[k]), 4)
                 for k in ('roc_auc', 'pr_auc', 'f1_attack', 'recall_attack', 'fpr')
                 if k in lstm_m and k in rb_m}
        print("\n=== LSTM vs Rule-Based Delta ===")
        for k, v in delta.items():
            better = (v > 0 and k != 'fpr') or (v < 0 and k == 'fpr')
            print(f"  {k}: {v:+.4f} {'↑' if better else '↓'}")

        # Combined PR + ROC plots
        score_map = {'LSTM': y_score, 'Rule-Based': rule_scores}
        plot_pr_curves(y_true, score_map, report_dir / 'pr_curve.png')
        plot_roc_curves(y_true, score_map, report_dir / 'comparison_roc.png')
    else:
        # LSTM-only plots
        if len(np.unique(y_true)) > 1:
            plot_pr_curves(y_true, {'LSTM': y_score}, report_dir / 'pr_curve.png')
            plot_roc_curves(y_true, {'LSTM': y_score}, report_dir / 'comparison_roc.png')
        delta = {}

    # ── Save JSON outputs ─────────────────────────────────────────────────────
    with open(report_dir / 'metrics_test.json', 'w') as f:
        json.dump(lstm_m, f, indent=2)

    comparison = {
        'lstm':       lstm_m,
        'rule_based': rb_m,
        'delta':      delta if rb_m else {},
    }
    with open(report_dir / 'comparison_lstm_vs_rule.json', 'w') as f:
        json.dump(comparison, f, indent=2, default=str)

    if lstm_sweep:
        with open(report_dir / 'threshold_sweep_lstm.json', 'w') as f:
            json.dump(lstm_sweep, f, indent=2)

    if rb_sweep:
        with open(report_dir / 'threshold_sweep_rule.json', 'w') as f:
            json.dump(rb_sweep, f, indent=2)

    # Predictions CSV
    df_preds = pd.DataFrame({'y_true': y_true, 'y_score_lstm': y_score})
    if rule_scores is not None:
        df_preds['y_score_rule'] = rule_scores
    df_preds.to_csv(report_dir / 'predictions.csv', index=False)

    print(f"\n[Evaluate] Reports saved to {report_dir}/")
    print(f"  metrics_test.json, metrics_rule_based.json, comparison_lstm_vs_rule.json")
    print(f"  confusion_matrix_lstm.png, confusion_matrix_rule.png")
    print(f"  comparison_roc.png, pr_curve.png")
    print(f"  threshold_sweep_lstm.png, threshold_sweep_rule.png")


if __name__ == '__main__':
    main()
