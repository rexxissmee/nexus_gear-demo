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

def create_windows(df: pd.DataFrame, cfg: dict, attack_markers: dict) -> dict:
    """
    Sliding window over each session.
    X: sequence features [t=1..L]
    y: binary label (0=NORMAL, 1=ATTACK) for the window
    """
    L = cfg['feature_builder']['window_length']
    stride = cfg['feature_builder']['stride']
    min_len = cfg['feature_builder']['min_session_length']
    
    flag_cols = ['flag_ip_change', 'flag_ua_change', 'flag_device_change', 
                 'flag_geo_change', 'flag_cookie_missing']
    
    X_events, X_dt, X_flags = [], [], []
    y_labels = []
    session_ids_out = []
    
    for session_id, grp in df.groupby('session_id'):
        grp = grp.sort_values('ts').reset_index(drop=True)
        n = len(grp)
        
        if n < min_len:
            continue
            
        event_ids = grp['event_id'].values
        log_dts = grp['log_dt'].values
        flags = grp[[c for c in flag_cols if c in grp.columns]].values if any(c in grp.columns for c in flag_cols) else np.zeros((n, len(flag_cols)))
        
        # Check if session has attack
        attack_ts = None
        if attack_markers and str(session_id) in attack_markers:
            attack_ts = pd.to_datetime(attack_markers[str(session_id)], utc=True)
            
        # Sliding windows
        for start in range(0, n - L + 1, stride):
            end = start + L
            X_events.append(event_ids[start:end])
            X_dt.append(log_dts[start:end])
            X_flags.append(flags[start:end])
            
            # Labeling logic
            label = 0
            if attack_ts is not None:
                # Window ends at index `end-1`
                last_event_ts = pd.to_datetime(grp.iloc[end-1]['ts'], utc=True)
                if last_event_ts >= attack_ts:
                    label = 1
            y_labels.append(label)
            session_ids_out.append(session_id)
            
    print(f"[FeatureBuilder] Created {len(X_events)} windows (Normal: {y_labels.count(0)}, Attack: {y_labels.count(1)}) from {df['session_id'].nunique()} sessions")
    
    return {
        'X_events':    np.array(X_events, dtype=np.int32),
        'X_dt':        np.array(X_dt, dtype=np.float32),
        'X_flags':     np.array(X_flags, dtype=np.float32),
        'y':           np.array(y_labels, dtype=np.float32),
        'session_ids': np.array(session_ids_out),
    }

# ── Train/Val/Test Split ──────────────────────────────────────────────────────

def split_dataset(data: dict, cfg: dict, seed: int = 42) -> tuple[dict, dict, dict]:
    """Split data grouped by session_id to avoid leakage."""
    session_ids = np.unique(data['session_ids'])
    np.random.seed(seed)
    np.random.shuffle(session_ids)
    
    n_sessions = len(session_ids)
    val_size = int(n_sessions * cfg['training']['val_split'])
    test_size = int(n_sessions * cfg['training']['test_split'])
    
    test_sessions  = set(session_ids[:test_size])
    val_sessions   = set(session_ids[test_size:test_size + val_size])
    train_sessions = set(session_ids[test_size + val_size:])
    
    train_idx, val_idx, test_idx = [], [], []
    for i, s_id in enumerate(data['session_ids']):
        if s_id in test_sessions:
            test_idx.append(i)
        elif s_id in val_sessions:
            val_idx.append(i)
        else:
            train_idx.append(i)
            
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
        
    out_dir = Path(cfg['artifacts']['dataset_dir'])
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Load labels
    attack_markers = {}
    marker_file = out_dir / "attack_markers.json"
    if marker_file.exists():
        with open(marker_file) as f:
            attack_markers = json.load(f)
    else:
        print(f"[FeatureBuilder] WARNING: {marker_file} not found. All labels will be 0.")
    
    # Load and process events
    try:
        df = fetch_events(db_url, args.split)
        if df.empty:
            print("[FeatureBuilder] No events found.")
            sys.exit(0)
    except Exception as e:
        print(f"Error fetching: {e}")
        sys.exit(1)
        
    df = build_features(df, vocab, cfg)
    
    # Create windows
    data = create_windows(df, cfg, attack_markers=attack_markers)
    if len(data['X_events']) == 0:
        print("[FeatureBuilder] No windows extracted (sessions too short?).")
        sys.exit(0)
        
    # Split
    train, val, test = split_dataset(data, cfg, seed=cfg.get('seed', 42))
    
    # Save datasets
    for name, split_data in [('train', train), ('val', val), ('test', test)]:
        np.savez(out_dir / f'dataset_{name}.npz', **split_data)
        print(f"[FeatureBuilder] Saved {len(split_data['X_events'])} samples → {out_dir}/dataset_{name}.npz")
        
    # Save separate split mappings
    split_info = {
        'train_sessions_count': len(np.unique(train['session_ids'])),
        'val_sessions_count': len(np.unique(val['session_ids'])),
        'test_sessions_count': len(np.unique(test['session_ids']))
    }
    with open(out_dir / 'split.json', 'w') as f:
        json.dump(split_info, f, indent=2)
        
    # Save unique session ids that made it through
    with open(out_dir / 'session_ids.json', 'w') as f:
        json.dump(list(np.unique(data['session_ids'])), f, indent=2)
        
    # Extract 'y' array directly for label validations later if needed (often stored inside npz, but let's provide standalone optionally)
    np.save(out_dir / 'y.npy', data['y'])
    
    # Save metadata
    meta = {
        'vocab_size': len(vocab),
        'window_length': cfg['feature_builder']['window_length'],
        'stride': cfg['feature_builder']['stride'],
        'total_windows': len(data['X_events']),
        'train_size': len(train['X_events']),
        'val_size': len(val['X_events']),
        'test_size': len(test['X_events']),
        'num_attack_windows': int(data['y'].sum()),
        'created_at': datetime.utcnow().isoformat(),
        'seed': cfg.get('seed', 42),
    }
    with open(out_dir / 'dataset_meta.json', 'w') as f:
        json.dump(meta, f, indent=2)
        
    print(f"[FeatureBuilder] Done. Metadata saved to {out_dir}/dataset_meta.json")

if __name__ == '__main__':
    main()
