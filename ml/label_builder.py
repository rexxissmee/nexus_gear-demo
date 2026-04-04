import os
import sys
import json
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# ── Flag events that signal the actual start of an attack ──────────────────────
# A window is only labelled ATTACK if it CONTAINS these events,
# not just because the session was eventually revoked.
ATTACK_SIGNAL_EVENTS = (
    'FLAG_IP_CHANGE',
    'FLAG_UA_CHANGE',
    'FLAG_DEVICE_CHANGE',
    'FLAG_GEO_CHANGE',
    'REQUEST_BURST',
    'STATUS_401',
    'STATUS_403',
)

def main():
    print("╔══════════════════════════════════════════╗")
    print("║  Label Builder (M1) - Session Hijacking  ║")
    print("╚══════════════════════════════════════════╝")

    load_dotenv(dotenv_path='.env')
    load_dotenv(dotenv_path='../.env')

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("[ERROR] DATABASE_URL not found in environment.")
        sys.exit(1)

    try:
        conn   = psycopg2.connect(db_url)
        cursor = conn.cursor()
    except Exception as e:
        print(f"[ERROR] Failed to connect to database: {e}")
        sys.exit(1)

    print("[LabelBuilder] Connected to PostgreSQL. Querying attack sessions...")

    # ── Step 1: get all sessions revoked due to attack ─────────────────────────
    cursor.execute("""
        SELECT session_id, revoke_reason
        FROM sessions
        WHERE revoke_reason LIKE '%ATTACK%'
           OR revoke_reason LIKE '%ADMIN_LABEL_ATTACK%'
    """)
    attack_sessions = cursor.fetchall()
    print(f"[LabelBuilder] Found {len(attack_sessions)} attack sessions.")

    # ── Step 2: for each session, find the FIRST attack-signal event ───────────
    placeholders = ','.join(['%s'] * len(ATTACK_SIGNAL_EVENTS))
    attack_markers = {}
    label_map      = {}
    label_sources  = {}
    session_labels = {}

    n_first_flag  = 0   # sessions where we found a flag event
    n_fallback    = 0   # sessions with no flag → fall back to revoke_at

    for sid, reason in attack_sessions:
        # Query the EARLIEST attack-signal event in this session
        cursor.execute(f"""
            SELECT MIN(ts) as first_flag_ts
            FROM session_events
            WHERE session_id = %s
              AND event_type IN ({placeholders})
        """, (sid, *ATTACK_SIGNAL_EVENTS))
        flag_row = cursor.fetchone()

        if flag_row and flag_row[0]:
            # ── Primary: use first flag event as attack start ──────────────────
            attack_ts  = flag_row[0]
            source     = "first_flag_event"
            n_first_flag += 1
        else:
            # ── Fallback: no flag found — use revoked_at from sessions table ───
            # This covers cases where attack was manual-labelled without flags.
            cursor.execute(
                "SELECT revoked_at FROM sessions WHERE session_id = %s", (sid,)
            )
            ts_row = cursor.fetchone()
            if ts_row and ts_row[0]:
                attack_ts = ts_row[0]
                source    = "revoked_at_fallback"
            else:
                # Last resort: first event of session (original behaviour)
                cursor.execute(
                    "SELECT MIN(ts) FROM session_events WHERE session_id = %s", (sid,)
                )
                ts_row2 = cursor.fetchone()
                if not ts_row2 or not ts_row2[0]:
                    print(f"  [SKIP] {sid[:16]}… — no events found")
                    continue
                attack_ts = ts_row2[0]
                source    = "session_start_fallback"
            n_fallback += 1

        ts_iso = attack_ts.isoformat()
        if not ts_iso.endswith(('Z', '+00:00')):
            ts_iso += "Z"

        attack_markers[sid] = ts_iso
        label_map[sid]      = 1
        label_sources[sid]  = source
        session_labels[sid] = "ATTACK"

    # ── Step 3: save artifacts ─────────────────────────────────────────────────
    out_dir = Path("artifacts/datasets")
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(out_dir / "attack_markers.json",  "w") as f:
        json.dump(attack_markers, f, indent=2, default=str)
    with open(out_dir / "label_map.json",        "w") as f:
        json.dump(label_map, f, indent=2)
    with open(out_dir / "label_sources.json",    "w") as f:
        json.dump(label_sources, f, indent=2)
    with open(out_dir / "session_labels.json",   "w") as f:
        json.dump(session_labels, f, indent=2)

    print(f"[LabelBuilder] Extracted {len(attack_markers)} attack markers.")
    print(f"  → Using first flag event : {n_first_flag} sessions")
    print(f"  → Fallback (revoked_at / session start): {n_fallback} sessions")
    print(f"[LabelBuilder] Done. Artifacts saved to {out_dir}/")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
