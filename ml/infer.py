"""
ml/infer.py – LSTM inference CLI
─────────────────────────────────────────────────────────────────────────────
Reads a JSON event window from stdin, scores it with the trained LSTM model,
prints the anomaly score to stdout (one float, newline-terminated).

Called from Next.js /api/security/score via child_process:
  echo '{"events":[...]}' | python ml/infer.py

Input JSON schema:
  {
    "events": [
      { "event_type": "API_CALL_NORMAL", "delta_t_ms": 3200 },
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
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH  = os.path.join(SCRIPT_DIR, 'config.yaml')
VOCAB_PATH   = os.path.join(SCRIPT_DIR, 'vocab.json')
MODEL_PATH   = os.path.join(SCRIPT_DIR, 'artifacts', 'models', 'best_model.pt')

# ── Load config & vocab ────────────────────────────────────────────────────────
def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)

def load_vocab():
    with open(VOCAB_PATH) as f:
        return json.load(f)

# ── Model definition (must match train.py exactly) ───────────────────────────
class LSTMNextEventModel(torch.nn.Module):
    def __init__(self, vocab_size, embedding_dim, hidden_size, num_layers, dropout, pad_idx=19):
        super().__init__()
        self.embedding  = torch.nn.Embedding(vocab_size, embedding_dim, padding_idx=pad_idx)
        self.lstm       = torch.nn.LSTM(
            input_size=embedding_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.dropout    = torch.nn.Dropout(dropout)
        self.classifier = torch.nn.Linear(hidden_size, vocab_size)

    def forward(self, x):
        emb    = self.dropout(self.embedding(x))         # (B, L, E)
        out, _ = self.lstm(emb)                          # (B, L, H)
        logits = self.classifier(self.dropout(out))      # (B, L, V)
        return logits

# ── Inference ──────────────────────────────────────────────────────────────────
def compute_score(events_raw, cfg, vocab, model, device):
    """
    events_raw: list of {"event_type": str, "delta_t_ms": number}
    Returns: float anomaly score (mean negative log-prob over sequence)
    """
    UNK = vocab.get('<UNK>', len(vocab) - 1)
    W   = cfg['feature_builder']['window_length']  # e.g. 30

    ids = [vocab.get(e.get('event_type', ''), UNK) for e in events_raw]
    if len(ids) < 2:
        return 0.0

    ids = ids[:W]
    x_ev = torch.tensor([ids[:-1]], dtype=torch.long).to(device)   # (1, L-1)
    y    = torch.tensor([ids[1:]],  dtype=torch.long).to(device)    # (1, L-1)

    with torch.no_grad():
        logits    = model(x_ev)                           # (1, L-1, V)
        log_probs = torch.nn.functional.log_softmax(logits, dim=-1)
        step_losses = [-log_probs[0, t, y[0, t].item()].item() for t in range(logits.shape[1])]

    return float(np.mean(step_losses)) if step_losses else 0.0

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    # Load model
    if not os.path.exists(MODEL_PATH):
        print(f'ERROR: model not found at {MODEL_PATH}', file=sys.stderr)
        sys.exit(1)

    cfg   = load_config()
    vocab = load_vocab()

    model_cfg = cfg['model']
    device    = torch.device('cpu')  # inference on CPU (lightweight)

    model = LSTMNextEventModel(
        vocab_size    = model_cfg['vocab_size'],
        embedding_dim = model_cfg['embedding_dim'],
        hidden_size   = model_cfg['lstm_hidden'],
        num_layers    = model_cfg['lstm_layers'],
        dropout       = model_cfg.get('dropout', 0.2),
    )

    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    state_dict = checkpoint.get('model_state_dict', checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    # Read input
    try:
        raw = sys.stdin.read().strip()
        data = json.loads(raw)
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
