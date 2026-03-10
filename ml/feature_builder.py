"""
M2 – Feature Builder + Windowing
Reads session events from PostgreSQL, builds windowed dataset for LSTM training.

Usage:
  python feature_builder.py [--config config.yaml] [--split normal|attack|all]
"""

import os
import sys
import json
import math
import random
import argparse
import traceback
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import psycopg2
import yaml
from dotenv import load_dotenv

# ── Config ──────────────────────────────────────────────────────────────────

def load_config(path: str = "config.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)

# ── Database ─────────────────────────────────────────────────────────────────

def fetch_events(db_url: str, split: str = "all") -> pd.DataFrame:
    """Load session_events from PostgreSQL."""
    print(f"[FeatureBuilder] Connecting to database...")
    conn = psycopg2.connect(db_url)
    
    query = """
        SELECT 
            se.session_id,
            se.event_type,
            se.event_type_id,
            se.delta_t_ms,
            se.flags,
            se.metrics,
            se.config,
            se.ts,
            s.revoked_at IS NOT NULL AS is_revoked,
            s.user_id
        FROM session_events se
        JOIN sessions s ON se.session_id = s.session_id
        ORDER BY se.session_id, se.ts
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    print(f"[FeatureBuilder] Loaded {len(df)} events from {df['session_id'].nunique()} sessions")
    return df

# ── Feature Engineering ───────────────────────────────────────────────────────

def build_features(df: pd.DataFrame, vocab: dict, cfg: dict) -> pd.DataFrame:
    """Transform raw events into ML features."""
    
    # Map event_type → id via vocab (use event_type_id from DB if already set)
    df = df.copy()
    df['event_id'] = df['event_type'].map(vocab).fillna(vocab.get('<UNK>', 20)).astype(int)
    
    # Transform delta_t: log(1 + delta_t_ms)
    df['log_dt'] = np.log1p(df['delta_t_ms'].clip(lower=0))
    
    # Expand flags (JSON column)
    if df['flags'].dtype == object:
        flags_df = pd.json_normalize(df['flags'].apply(
            lambda x: json.loads(x) if isinstance(x, str) else (x or {})
        ))
        for col in ['ip_change', 'ua_change', 'device_change', 'geo_change', 'cookie_missing']:
            df[f'flag_{col}'] = flags_df.get(col, pd.Series(0, index=df.index)).fillna(0).astype(int)
    
    return df

# ── Windowing ─────────────────────────────────────────────────────────────────

def create_windows(df: pd.DataFrame, cfg: dict) -> dict:
    """
    Sliding window over each session.
    X: event_id sequence [t=1..L-1]
    y_event: next event_id [t=2..L]
    """
    L = cfg['feature_builder']['window_length']
    stride = cfg['feature_builder']['stride']
    min_len = cfg['feature_builder']['min_session_length']
    
    flag_cols = ['flag_ip_change', 'flag_ua_change', 'flag_device_change', 
                 'flag_geo_change', 'flag_cookie_missing']
    
    X_events, X_dt, X_flags = [], [], []
    y_events = []
    session_ids_out = []
    
    for session_id, grp in df.groupby('session_id'):
        grp = grp.sort_values('ts').reset_index(drop=True)
        n = len(grp)
        
        if n < min_len:
            continue
        
        event_ids = grp['event_id'].values
        log_dts = grp['log_dt'].values
        flags = grp[[c for c in flag_cols if c in grp.columns]].values if any(c in grp.columns for c in flag_cols) else np.zeros((n, len(flag_cols)))
        
        # Sliding windows
        for start in range(0, n - L + 1, stride):
            end = start + L
            X_events.append(event_ids[start:end-1])   # input: t=1..L-1
            X_dt.append(log_dts[start:end-1])
            X_flags.append(flags[start:end-1])
            y_events.append(event_ids[start+1:end])   # target: t=2..L (next event)
            session_ids_out.append(session_id)
    
    print(f"[FeatureBuilder] Created {len(X_events)} windows from {df['session_id'].nunique()} sessions")
    
    return {
        'X_events':    np.array(X_events, dtype=np.int32),
        'X_dt':        np.array(X_dt, dtype=np.float32),
        'X_flags':     np.array(X_flags, dtype=np.float32),
        'y_events':    np.array(y_events, dtype=np.int32),
        'session_ids': np.array(session_ids_out),
    }

# ── Train/Val/Test Split ──────────────────────────────────────────────────────

def split_dataset(data: dict, cfg: dict, seed: int = 42) -> tuple[dict, dict, dict]:
    n = len(data['X_events'])
    idx = list(range(n))
    random.seed(seed)
    random.shuffle(idx)
    
    val_size = int(n * cfg['training']['val_split'])
    test_size = int(n * cfg['training']['test_split'])
    
    test_idx  = idx[:test_size]
    val_idx   = idx[test_size:test_size + val_size]
    train_idx = idx[test_size + val_size:]
    
    def subset(idx_list):
        return {k: v[idx_list] for k, v in data.items()}
    
    return subset(train_idx), subset(val_idx), subset(test_idx)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='config.yaml')
    parser.add_argument('--split', default='all', choices=['normal', 'attack', 'all'])
    args = parser.parse_args()
    
    load_dotenv(dotenv_path='.env')
    load_dotenv(dotenv_path='../.env')
    
    cfg = load_config(args.config)
    db_url = os.getenv('DATABASE_URL', cfg.get('database_url', ''))
    
    if not db_url:
        print("ERROR: DATABASE_URL not set. Add to .env or config.yaml")
        sys.exit(1)
    
    with open('vocab.json') as f:
        vocab = json.load(f)
    
    # Load and process events
    df = fetch_events(db_url, args.split)
    df = build_features(df, vocab, cfg)
    
    # Create windows
    data = create_windows(df, cfg)
    
    # Split
    train, val, test = split_dataset(data, cfg, seed=cfg.get('seed', 42))
    
    # Save
    out_dir = Path(cfg['artifacts']['dataset_dir'])
    out_dir.mkdir(parents=True, exist_ok=True)
    
    for name, split in [('train', train), ('val', val), ('test', test)]:
        np.savez(out_dir / f'dataset_{name}.npz', **split)
        print(f"[FeatureBuilder] Saved {len(split['X_events'])} samples → {out_dir}/dataset_{name}.npz")
    
    # Save metadata
    meta = {
        'vocab_size': len(vocab),
        'window_length': cfg['feature_builder']['window_length'],
        'stride': cfg['feature_builder']['stride'],
        'total_windows': len(data['X_events']),
        'train_size': len(train['X_events']),
        'val_size': len(val['X_events']),
        'test_size': len(test['X_events']),
        'created_at': datetime.utcnow().isoformat(),
        'seed': cfg.get('seed', 42),
    }
    with open(out_dir / 'dataset_meta.json', 'w') as f:
        json.dump(meta, f, indent=2)
    
    print(f"[FeatureBuilder] Done. Metadata saved to {out_dir}/dataset_meta.json")

if __name__ == '__main__':
    main()
