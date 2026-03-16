"""
M5 – Supervised Evaluation Script (ROC-AUC, PR-AUC, FPR, F1, Confusion Matrix)
Evalutes the `best_model.pt` predictions against the test dataset windows.

Usage:
  python evaluate.py [--config config.yaml]
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score, 
    confusion_matrix, ConfusionMatrixDisplay, roc_curve, precision_recall_curve
)
import yaml

from train import SessionDataset, LSTMSupervisedModel, load_config

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='config.yaml')
    args = parser.parse_args()

    cfg = load_config(args.config)
    report_dir = Path(cfg.get('artifacts', {}).get('report_dir', 'artifacts/reports'))
    model_dir  = Path(cfg.get('artifacts', {}).get('model_dir', 'artifacts/models'))
    data_dir   = Path(cfg.get('artifacts', {}).get('dataset_dir', 'artifacts/datasets'))
    report_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    # Load test dataset
    test_ds_path = data_dir / 'dataset_test.npz'
    if not test_ds_path.exists():
        print(f"ERROR: Test dataset not found at {test_ds_path}")
        return
        
    test_ds = SessionDataset(test_ds_path)
    test_loader = DataLoader(test_ds, batch_size=128, shuffle=False)

    mcfg = cfg['model']
    model = LSTMSupervisedModel(
        vocab_size    = mcfg['vocab_size'],
        embedding_dim = mcfg['embedding_dim'],
        extra_dim     = mcfg.get('extra_dim', 6),
        hidden_size   = mcfg['lstm_hidden'],
        num_layers    = mcfg['lstm_layers'],
        dropout       = 0.0,
    ).to(device)

    model_path = model_dir / 'best_model.pt'
    if not model_path.exists():
        print(f"ERROR: Model not found at {model_path}")
        return

    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=False))
    model.eval()

    all_preds = []
    all_labels = []

    print("[Evaluate] Running inference on test set...")
    with torch.no_grad():
        for X_ev, X_dt, X_flags, y in test_loader:
            X_ev, X_dt, X_flags = X_ev.to(device), X_dt.to(device), X_flags.to(device)
            x_cont = torch.cat([X_dt, X_flags], dim=-1)
            logits = model(X_ev, x_cont)
            probs = torch.sigmoid(logits).cpu().numpy()
            all_preds.extend(probs)
            all_labels.extend(y.numpy())

    y_score = np.array(all_preds)
    y_true = np.array(all_labels)

    # Thresholds
    thresholds_json = {
        'WARN': 0.50,
        'STEP_UP': 0.70,
        'REVOKE': 0.90
    }
    
    y_pred_warn = (y_score >= thresholds_json['WARN']).astype(int)

    # Metrics
    if len(np.unique(y_true)) > 1:
        roc_auc = roc_auc_score(y_true, y_score)
        f1 = f1_score(y_true, y_pred_warn)
        prec = precision_score(y_true, y_pred_warn, zero_division=0)
        rec = recall_score(y_true, y_pred_warn, zero_division=0)
        cm = confusion_matrix(y_true, y_pred_warn)
        tn, fp, fn, tp = cm.ravel()
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
    else:
        # Edge case: no attack data in test set
        print("WARNING: Only one class present in test set. AUROC cannot be calculated.")
        roc_auc = f1 = prec = rec = fpr = fnr = 0.0
        cm = confusion_matrix(y_true, y_pred_warn, labels=[0, 1])

    metrics = {
        'roc_auc': round(float(roc_auc), 4),
        'f1_score': round(float(f1), 4),
        'precision': round(float(prec), 4),
        'recall': round(float(rec), 4),
        'fpr': round(float(fpr), 4),
        'fnr': round(float(fnr), 4),
        'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp),
        'n_test_samples': len(y_true),
        'n_attack': int(sum(y_true)),
        'n_normal': int(len(y_true) - sum(y_true)),
        'evaluated_at': datetime.utcnow().isoformat(),
    }

    print("\n=== Evaluation Results ===")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # Confusion Matrix Plot
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=['NORMAL', 'ATTACK'])
    disp.plot(cmap='Blues', values_format='d')
    plt.title('Confusion Matrix (Threshold=0.5)')
    plt.savefig(report_dir / 'confusion_matrix.png', dpi=150)
    plt.close()

    if len(np.unique(y_true)) > 1:
        # ROC Curve
        fpr_vals, tpr_vals, _ = roc_curve(y_true, y_score)
        plt.figure(figsize=(6, 5))
        plt.plot(fpr_vals, tpr_vals, label=f'LSTM (AUC={roc_auc:.3f})')
        plt.plot([0,1],[0,1],'--', color='gray', label='Random')
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title('ROC Curve – Supervised Classification')
        plt.legend()
        plt.tight_layout()
        plt.savefig(report_dir / 'roc_curve.png', dpi=150)
        plt.close()

        # PR Curve
        prec_vals, rec_vals, _ = precision_recall_curve(y_true, y_score)
        plt.figure(figsize=(6, 5))
        plt.plot(rec_vals, prec_vals, label=f'LSTM (F1={f1:.3f})')
        plt.xlabel('Recall')
        plt.ylabel('Precision')
        plt.title('Precision-Recall Curve')
        plt.legend()
        plt.tight_layout()
        plt.savefig(report_dir / 'pr_curve.png', dpi=150)
        plt.close()

    # Save metrics
    out = report_dir / 'metrics_test.json'
    with open(out, 'w') as f:
        json.dump(metrics, f, indent=2)
        
    # Save predictions
    df_preds = pd.DataFrame({'y_true': y_true, 'y_score': y_score})
    df_preds.to_csv(report_dir / 'predictions.csv', index=False)

    print(f"\n[Evaluate] Report & plots saved to {report_dir}/")

if __name__ == '__main__':
    main()
