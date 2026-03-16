"""
ml/infer.py – LSTM Supervised Sequence Classification Inference CLI
─────────────────────────────────────────────────────────────────────────────
Reads a JSON event window from stdin, scores it with the trained LSTM classifier,
prints the predicted JSON to stdout.

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

Output JSON:
  {
    "predicted_label": "ATTACK",
    "class_probs": { "NORMAL": 0.21, "ATTACK": 0.79 },
    "risk_score": 0.79
  }
"""

import sys
import json
import math
import os
import numpy as np
import torch
import yaml

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, 'config.yaml')
VOCAB_PATH  = os.path.join(SCRIPT_DIR, 'vocab.json')
MODEL_PATH  = os.path.join(SCRIPT_DIR, 'artifacts', 'models', 'best_model.pt')

FLAG_ORDER = ['ip_change', 'ua_change', 'device_change', 'geo_change', 'cookie_missing']
NUM_FLAGS  = len(FLAG_ORDER)  # 5

def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)

def load_vocab():
    with open(VOCAB_PATH) as f:
        return json.load(f)

# ── Model definition (must match train.py) ────────────────────────────────────
class LSTMSupervisedModel(torch.nn.Module):
    def __init__(self, vocab_size, embedding_dim, extra_dim,
                 hidden_size, num_layers, dropout, pad_idx=19):
        super().__init__()
        self.embedding = torch.nn.Embedding(vocab_size, embedding_dim, padding_idx=pad_idx)
        self.lstm = torch.nn.LSTM(
            input_size=embedding_dim + extra_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.dropout = torch.nn.Dropout(dropout)
        self.classifier = torch.nn.Linear(hidden_size, 1)

    def forward(self, x_ev, x_cont):
        emb = self.dropout(self.embedding(x_ev))
        inp = torch.cat([emb, x_cont], dim=-1)
        out, _ = self.lstm(inp)
        last_hidden = out[:, -1, :]
        logits = self.classifier(self.dropout(last_hidden))
        return logits.squeeze(-1)

# ── Feature extraction ─────────────────────────────────────────────────────────
def extract_features(events_raw, vocab, W):
    UNK = vocab.get('<UNK>', len(vocab) - 1)
    events = events_raw[:W]
    
    ids   = [vocab.get(e.get('event_type', ''), UNK) for e in events]
    dts   = [float(e.get('delta_t_ms', 0)) for e in events]
    flags = [e.get('flags', {}) if isinstance(e.get('flags'), dict) else {} for e in events]

    log_dts = [math.log1p(max(0.0, d)) for d in dts]
    flag_vecs = [[float(f.get(col, 0)) for col in FLAG_ORDER] for f in flags]

    ids_arr   = np.array(ids, dtype=np.int64)
    dts_arr   = np.array(log_dts, dtype=np.float32)
    flgs_arr  = np.array(flag_vecs, dtype=np.float32)

    x_ev   = torch.tensor(ids_arr[np.newaxis, :], dtype=torch.long)
    dt_t   = torch.tensor(dts_arr[:, np.newaxis], dtype=torch.float32)
    flg_t  = torch.tensor(flgs_arr, dtype=torch.float32)
    x_cont = torch.cat([dt_t, flg_t], dim=-1).unsqueeze(0)

    return x_ev, x_cont

# ── Inference ──────────────────────────────────────────────────────────────────
def compute_score(events_raw, cfg, vocab, model, device):
    W = cfg['feature_builder']['window_length']

    if len(events_raw) == 0:
        return {"predicted_label": "NORMAL", "class_probs": {"NORMAL": 1.0, "ATTACK": 0.0}, "risk_score": 0.0}

    x_ev, x_cont = extract_features(events_raw, vocab, W)
    x_ev   = x_ev.to(device)
    x_cont = x_cont.to(device)

    with torch.no_grad():
        logits = model(x_ev, x_cont)
        prob = torch.sigmoid(logits).item()

    is_attack = prob >= 0.5
    
    return {
        "predicted_label": "ATTACK" if is_attack else "NORMAL",
        "class_probs": {
            "NORMAL": 1.0 - prob,
            "ATTACK": prob
        },
        "risk_score": prob
    }

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    if not os.path.exists(MODEL_PATH):
        print(f'{{"error": "model not found at {MODEL_PATH}"}}', file=sys.stderr)
        sys.exit(1)

    cfg   = load_config()
    vocab = load_vocab()
    mcfg   = cfg['model']
    device = torch.device('cpu')

    model = LSTMSupervisedModel(
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

    try:
        raw    = sys.stdin.read().strip()
        data   = json.loads(raw)
        events = data.get('events', [])
    except Exception as e:
        print(f'{{"error": "invalid input: {e}"}}', file=sys.stderr)
        sys.exit(2)

    result = compute_score(events, cfg, vocab, model, device)
    
    # Print JSON output exactly
    print(json.dumps(result))
    sys.exit(0)

if __name__ == '__main__':
    main()
