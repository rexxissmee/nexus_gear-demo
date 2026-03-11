"""
ml/infer.py – LSTM Multimodal inference CLI
─────────────────────────────────────────────────────────────────────────────
Reads a JSON event window from stdin, scores it with the trained LSTM model,
prints the anomaly score to stdout (one float, newline-terminated).

Called from Next.js /api/security/score via child_process:
  echo '{"events":[...]}' | python ml/infer.py

Input JSON schema:
  {
    "events": [
      {
        "event_type": "API_CALL_NORMAL",
        "delta_t_ms": 3200,
        "flags": { "ip_change": 0, "ua_change": 0, "device_change": 0, "geo_change": 0, "cookie_missing": 0 }
      },
      ...
    ]
  }

Output:
  0.3142

Exit codes:
  0 – success
  1 – model not found / load error
  2 – input parsing error
"""

import sys
import json
import math
import os

import numpy as np
import torch
import yaml

# ── Locate files relative to this script ──────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, 'config.yaml')
VOCAB_PATH  = os.path.join(SCRIPT_DIR, 'vocab.json')
MODEL_PATH  = os.path.join(SCRIPT_DIR, 'artifacts', 'models', 'best_model.pt')

# Flag column order must match feature_builder.py
FLAG_ORDER = ['ip_change', 'ua_change', 'device_change', 'geo_change', 'cookie_missing']
NUM_FLAGS  = len(FLAG_ORDER)  # 5

# ── Load config & vocab ────────────────────────────────────────────────────────
def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)

def load_vocab():
    with open(VOCAB_PATH) as f:
        return json.load(f)

# ── Model definition (must match train.py exactly) ───────────────────────────
class LSTMNextEventModel(torch.nn.Module):
    def __init__(self, vocab_size, embedding_dim, extra_dim,
                 hidden_size, num_layers, dropout, pad_idx=19):
        super().__init__()
        self.embedding  = torch.nn.Embedding(vocab_size, embedding_dim, padding_idx=pad_idx)
        self.lstm       = torch.nn.LSTM(
            input_size  = embedding_dim + extra_dim,
            hidden_size = hidden_size,
            num_layers  = num_layers,
            dropout     = dropout if num_layers > 1 else 0.0,
            batch_first = True,
        )
        self.dropout    = torch.nn.Dropout(dropout)
        self.classifier = torch.nn.Linear(hidden_size, vocab_size)

    def forward(self, x_ev, x_cont):
        emb    = self.dropout(self.embedding(x_ev))       # (B, L, E)
        inp    = torch.cat([emb, x_cont], dim=-1)         # (B, L, E+extra_dim)
        out, _ = self.lstm(inp)                           # (B, L, H)
        logits = self.classifier(self.dropout(out))       # (B, L, V)
        return logits

# ── Feature extraction ─────────────────────────────────────────────────────────
def extract_features(events_raw, vocab, W):
    """
    events_raw: list of {"event_type": str, "delta_t_ms": number, "flags": dict}
    Returns:
        x_ev:   (1, L-1)         long tensor — event ids
        x_cont: (1, L-1, 6)     float tensor — [log_dt | flags×5]
        y:      (1, L-1)         long tensor — target event ids
    """
    UNK = vocab.get('<UNK>', len(vocab) - 1)
    events = events_raw[:W]
    L = len(events)

    ids   = [vocab.get(e.get('event_type', ''), UNK) for e in events]
    dts   = [float(e.get('delta_t_ms', 0)) for e in events]
    flags = [e.get('flags', {}) if isinstance(e.get('flags'), dict) else {} for e in events]

    # log(1 + delta_t_ms)
    log_dts = [math.log1p(max(0.0, d)) for d in dts]

    # flags → binary vector [ip, ua, device, geo, cookie]
    flag_vecs = [
        [float(f.get(col, 0)) for col in FLAG_ORDER]
        for f in flags
    ]

    # Build tensors for input slice [0..L-2], target slice [1..L-1]
    ids_arr   = np.array(ids,      dtype=np.int64)
    dts_arr   = np.array(log_dts,  dtype=np.float32)
    flgs_arr  = np.array(flag_vecs, dtype=np.float32)   # (L, 5)

    x_ev   = torch.tensor(ids_arr[:-1][np.newaxis, :],  dtype=torch.long)          # (1, L-1)
    y      = torch.tensor(ids_arr[1:][np.newaxis, :],   dtype=torch.long)          # (1, L-1)
    dt_t   = torch.tensor(dts_arr[:-1, np.newaxis],     dtype=torch.float32)       # (L-1, 1)
    flg_t  = torch.tensor(flgs_arr[:-1],                dtype=torch.float32)       # (L-1, 5)
    x_cont = torch.cat([dt_t, flg_t], dim=-1).unsqueeze(0)                         # (1, L-1, 6)

    return x_ev, x_cont, y

# ── Inference ──────────────────────────────────────────────────────────────────
def compute_score(events_raw, cfg, vocab, model, device):
    """
    Returns: float anomaly score (mean -log P(true_next | history))
    """
    W = cfg['feature_builder']['window_length']  # e.g. 30

    if len(events_raw) < 2:
        return 0.0

    x_ev, x_cont, y = extract_features(events_raw, vocab, W)
    x_ev   = x_ev.to(device)
    x_cont = x_cont.to(device)
    y      = y.to(device)

    with torch.no_grad():
        logits    = model(x_ev, x_cont)                          # (1, L-1, V)
        log_probs = torch.nn.functional.log_softmax(logits, dim=-1)
        step_losses = [
            -log_probs[0, t, y[0, t].item()].item()
            for t in range(logits.shape[1])
        ]

    return float(np.mean(step_losses)) if step_losses else 0.0

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    # Load model
    if not os.path.exists(MODEL_PATH):
        print(f'ERROR: model not found at {MODEL_PATH}', file=sys.stderr)
        sys.exit(1)

    cfg   = load_config()
    vocab = load_vocab()

    mcfg   = cfg['model']
    device = torch.device('cpu')  # inference on CPU

    model = LSTMNextEventModel(
        vocab_size    = mcfg['vocab_size'],
        embedding_dim = mcfg['embedding_dim'],
        extra_dim     = mcfg.get('extra_dim', 6),
        hidden_size   = mcfg['lstm_hidden'],
        num_layers    = mcfg['lstm_layers'],
        dropout       = mcfg.get('dropout', 0.2),
    )

    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    state_dict = checkpoint.get('model_state_dict', checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    # Read input from stdin
    try:
        raw    = sys.stdin.read().strip()
        data   = json.loads(raw)
        events = data.get('events', [])
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        sys.exit(2)

    score = compute_score(events, cfg, vocab, model, device)

    # Output as plain float
    print(f'{score:.6f}')
    sys.exit(0)

if __name__ == '__main__':
    main()
