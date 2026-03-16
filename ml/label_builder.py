"""
M1.5 – Label Builder
Generates window-level labels based on attack markers in session events.
"""

import os
import sys
import json
import argparse
import psycopg2
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

def get_db_url():
    load_dotenv(dotenv_path='.env')
    load_dotenv(dotenv_path='../.env')
    return os.getenv('DATABASE_URL')

def fetch_events_for_labeling(db_url):
    print("[LabelBuilder] Connecting to database...")
    conn = psycopg2.connect(db_url)
    query = """
        SELECT session_id, event_type, flags, ts
        FROM session_events
        ORDER BY session_id, ts
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    return df

def build_labels(df):
    session_labels = {}
    attack_markers = {}
    
    # Define indicators for an ATTACK session
    for session_id, grp in df.groupby('session_id'):
        grp = grp.sort_values('ts')
        attack_ts = None
        
        for _, row in grp.iterrows():
            is_attack = False
            
            # Check event_type for explicit attack markers
            if row['event_type'] in ['TOKEN_REPLAY', 'HIJACK_DETECTED', 'SUSPICIOUS_REVOKE']:
                is_attack = True
                
            # Check flags column (stored as JSON string or dict)
            flags = row['flags']
            if isinstance(flags, str):
                try:
                    flags_dict = json.loads(flags)
                    if flags_dict.get('is_attack') or flags_dict.get('compromised'):
                        is_attack = True
                except:
                    pass
            elif isinstance(flags, dict):
                if flags.get('is_attack') or flags.get('compromised'):
                    is_attack = True
                    
            if is_attack:
                attack_ts = row['ts']
                break
                
        if attack_ts is not None:
            session_labels[session_id] = 'ATTACK'
            attack_markers[session_id] = attack_ts.isoformat()
        else:
            session_labels[session_id] = 'NORMAL'
            
    return session_labels, attack_markers

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out_dir', default='artifacts/datasets')
    args = parser.parse_args()
    
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not set. Please set it in .env file.")
        sys.exit(1)
        
    df = fetch_events_for_labeling(db_url)
    if df.empty:
        print("[LabelBuilder] No events found in DB.")
        # Proceed with empty datasets anyway, user will insert train data later
        session_labels = {}
        attack_markers = {}
    else:
        session_labels, attack_markers = build_labels(df)
        
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with open(out_dir / "session_labels.json", "w") as f:
        json.dump(session_labels, f, indent=2)
        
    with open(out_dir / "attack_markers.json", "w") as f:
        json.dump(attack_markers, f, indent=2)
        
    label_map = {
        "NORMAL": 0,
        "ATTACK": 1
    }
    with open(out_dir / "label_map.json", "w") as f:
        json.dump(label_map, f, indent=2)
        
    print(f"[LabelBuilder] Labeling complete.")
    print(f"  Total sessions analyzed: {len(session_labels)}")
    print(f"  Normal sessions: {len(session_labels) - len(attack_markers)}")
    print(f"  Attack sessions: {len(attack_markers)}")
    print(f"  Outputs saved to: {out_dir}/")

if __name__ == "__main__":
    main()
