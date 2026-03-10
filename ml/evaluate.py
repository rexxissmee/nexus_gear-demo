"""
M5 – Evaluation Script (ROC-AUC, PR-AUC, FPR, Detection Rate, Time-to-Detect)
Requires labeled attack data. Normal = label 0, Attack = label 1.

Usage:
  python evaluate.py [--config config.yaml] [--normal test] [--attack-csv path/to/attack_scores.csv]
"""

import argparse
import json
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import yaml
from sklearn.metrics import roc_auc_score, average_precision_score, roc_curve, precision_recall_curve
import matplotlib.pyplot as plt


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def evaluate(normal_scores, attack_scores, report_dir, T_warn, T_block):
    """Full evaluation: ROC-AUC, PR-AUC, FPR, recall, time-to-detect."""
    
    # Combine
    y_true = np.concatenate([np.zeros(len(normal_scores)), np.ones(len(attack_scores))])
    y_score = np.concatenate([normal_scores, attack_scores])

    roc_auc = roc_auc_score(y_true, y_score)
    pr_auc  = average_precision_score(y_true, y_score)
    
    # FPR at warn threshold
    fpr_warn  = (normal_scores > T_warn).sum() / len(normal_scores)
    fpr_block = (normal_scores > T_block).sum() / len(normal_scores)
    
    # Detection rate (recall) at thresholds
    dr_warn  = (attack_scores > T_warn).sum() / len(attack_scores)
    dr_block = (attack_scores > T_block).sum() / len(attack_scores)

    metrics = {
        'roc_auc':   round(float(roc_auc), 4),
        'pr_auc':    round(float(pr_auc), 4),
        'fpr_at_T_warn':  round(float(fpr_warn), 4),
        'fpr_at_T_block': round(float(fpr_block), 4),
        'detection_rate_at_T_warn':  round(float(dr_warn), 4),
        'detection_rate_at_T_block': round(float(dr_block), 4),
        'n_normal': int(len(normal_scores)),
        'n_attack': int(len(attack_scores)),
        'T_warn':   round(float(T_warn), 4),
        'T_block':  round(float(T_block), 4),
        'evaluated_at': datetime.utcnow().isoformat(),
    }

    print("\n=== Evaluation Results ===")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # ROC Curve
    fpr_vals, tpr_vals, _ = roc_curve(y_true, y_score)
    plt.figure(figsize=(6, 5))
    plt.plot(fpr_vals, tpr_vals, label=f'LSTM (AUC={roc_auc:.3f})')
    plt.plot([0,1],[0,1],'--', color='gray', label='Random')
    plt.axvline(x=fpr_warn, color='orange', linestyle=':', label=f'T_warn FPR={fpr_warn:.3f}')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('ROC Curve – Session Hijacking Detection')
    plt.legend()
    plt.tight_layout()
    plt.savefig(report_dir / 'roc_curve.png', dpi=150)
    plt.close()

    # PR Curve
    prec, rec, _ = precision_recall_curve(y_true, y_score)
    plt.figure(figsize=(6, 5))
    plt.plot(rec, prec, label=f'LSTM (AP={pr_auc:.3f})')
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title('Precision-Recall Curve')
    plt.legend()
    plt.tight_layout()
    plt.savefig(report_dir / 'pr_curve.png', dpi=150)
    plt.close()

    # Score distributions
    plt.figure(figsize=(7, 4))
    plt.hist(normal_scores, bins=50, alpha=0.6, color='steelblue', label='Normal')
    plt.hist(attack_scores, bins=50, alpha=0.6, color='tomato', label='Attack')
    plt.axvline(T_warn,  color='orange', linestyle='--', label=f'T_warn={T_warn:.3f}')
    plt.axvline(T_block, color='red',    linestyle='--', label=f'T_block={T_block:.3f}')
    plt.xlabel('Anomaly Score')
    plt.ylabel('Count')
    plt.title('Score Distribution: Normal vs Attack')
    plt.legend()
    plt.tight_layout()
    plt.savefig(report_dir / 'score_distribution.png', dpi=150)
    plt.close()

    print(f"\n[Evaluate] Figures saved to {report_dir}/")
    return metrics


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='config.yaml')
    parser.add_argument('--normal-csv', default=None,
                        help='CSV with window_score column for normal sessions')
    parser.add_argument('--attack-csv', default=None,
                        help='CSV with window_score column for attack sessions')
    args = parser.parse_args()

    cfg = load_config(args.config)
    report_dir = Path(cfg['artifacts']['report_dir'])
    model_dir  = Path(cfg['artifacts']['model_dir'])
    report_dir.mkdir(parents=True, exist_ok=True)

    # Load thresholds
    thresholds_path = model_dir / 'thresholds.json'
    if not thresholds_path.exists():
        print("ERROR: Run score_batch.py first to generate thresholds.json")
        return
    with open(thresholds_path) as f:
        thresholds = json.load(f)
    T_warn  = thresholds['T_warn']
    T_block = thresholds['T_block']

    # Load scores – support CSV from score_batch.py or manual provide
    if args.normal_csv:
        normal_df = pd.read_csv(args.normal_csv)
        normal_scores = normal_df['window_score'].values
    else:
        # Try to load from default batch output
        csvs = sorted(report_dir.glob('batch_scores_test_*.csv'))
        if not csvs:
            print("ERROR: No score CSV found. Run score_batch.py first.")
            return
        df = pd.read_csv(csvs[-1])
        normal_scores = df['window_score'].values
        print(f"[Evaluate] Loaded normal scores from {csvs[-1]}")

    if args.attack_csv:
        attack_df = pd.read_csv(args.attack_csv)
        attack_scores = attack_df['window_score'].values
    else:
        # Synthetic attack dataset: perturb normal scores upward to simulate hijacking
        print("[Evaluate] No attack CSV provided. Generating synthetic attack scores for demo...")
        attack_scores = normal_scores * np.random.uniform(1.5, 3.0, len(normal_scores))

    metrics = evaluate(normal_scores, attack_scores, report_dir, T_warn, T_block)

    # Save report
    out = report_dir / f'evaluation_report_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json'
    with open(out, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"[Evaluate] Report saved → {out}")


if __name__ == '__main__':
    main()
