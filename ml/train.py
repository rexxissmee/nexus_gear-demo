"""
M3 – LSTM Next-Event Prediction Training (Multimodal)
Trains a self-supervised LSTM on normal session sequences.
Input: event_id (embedded) + log(1+delta_t) + 5 binary flags

Usage:
  python train.py [--config config.yaml] [--data-dir artifacts/datasets]
"""

import os
import json
import random
import argparse
import traceback
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import yaml

# ── Config ──────────────────────────────────────────────────────────────────

def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)

def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

# ── Dataset ──────────────────────────────────────────────────────────────────

FLAG_COLS = ['flag_ip_change', 'flag_ua_change', 'flag_device_change',
             'flag_geo_change', 'flag_cookie_missing']
NUM_FLAGS = len(FLAG_COLS)  # 5

class SessionDataset(Dataset):
    def __init__(self, npz_path):
        data = np.load(npz_path)
        self.X_ev    = torch.tensor(data['X_events'], dtype=torch.long)    # (N, L-1)
        self.y_ev    = torch.tensor(data['y_events'], dtype=torch.long)    # (N, L-1)

        # delta_t: shape (N, L-1) → add feature dim → (N, L-1, 1)
        if 'X_dt' in data:
            dt = data['X_dt'].astype(np.float32)           # (N, L-1)
            self.X_dt = torch.tensor(dt).unsqueeze(-1)     # (N, L-1, 1)
        else:
            self.X_dt = torch.zeros(len(self.X_ev), self.X_ev.shape[1], 1)

        # flags: shape (N, L-1, 5) — may contain fewer than NUM_FLAGS columns
        if 'X_flags' in data:
            fl = data['X_flags'].astype(np.float32)        # (N, L-1, k)
            # Pad to NUM_FLAGS if dataset has fewer flag columns
            if fl.shape[-1] < NUM_FLAGS:
                pad = np.zeros((*fl.shape[:-1], NUM_FLAGS - fl.shape[-1]), dtype=np.float32)
                fl = np.concatenate([fl, pad], axis=-1)
            self.X_flags = torch.tensor(fl[:, :, :NUM_FLAGS])  # (N, L-1, 5)
        else:
            self.X_flags = torch.zeros(len(self.X_ev), self.X_ev.shape[1], NUM_FLAGS)

    def __len__(self):
        return len(self.X_ev)

    def __getitem__(self, idx):
        return self.X_ev[idx], self.X_dt[idx], self.X_flags[idx], self.y_ev[idx]

# ── Model ─────────────────────────────────────────────────────────────────────

class LSTMNextEventModel(nn.Module):
    """
    Multimodal LSTM for next-event prediction.
    Input per timestep: concat(embedding(event_id), log_dt, flags)
    Target: next event_id at each step.
    """

    def __init__(self, vocab_size, embedding_dim, extra_dim,
                 hidden_size, num_layers, dropout, pad_idx=19):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim, padding_idx=pad_idx)
        lstm_input_size = embedding_dim + extra_dim   # 64 + 6 = 70
        self.lstm = nn.LSTM(
            input_size=lstm_input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.dropout    = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_size, vocab_size)

    def forward(self, x_ev, x_cont):
        """
        x_ev:   (B, L)  event ids
        x_cont: (B, L, extra_dim)  continuous features (log_dt | flags)
        """
        emb = self.dropout(self.embedding(x_ev))     # (B, L, E)
        inp = torch.cat([emb, x_cont], dim=-1)       # (B, L, E+extra_dim)
        out, _ = self.lstm(inp)                      # (B, L, H)
        logits = self.classifier(self.dropout(out))  # (B, L, V)
        return logits

# ── Training Loop ─────────────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, total_tokens = 0.0, 0
    for X_ev, X_dt, X_flags, y in loader:
        X_ev, X_dt, X_flags, y = (
            X_ev.to(device), X_dt.to(device), X_flags.to(device), y.to(device)
        )
        x_cont = torch.cat([X_dt, X_flags], dim=-1)   # (B, L, 6)
        optimizer.zero_grad()
        logits = model(X_ev, x_cont)                  # (B, L, V)
        loss = criterion(logits.reshape(-1, logits.size(-1)), y.reshape(-1))
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total_loss   += loss.item() * y.numel()
        total_tokens += y.numel()
    return total_loss / total_tokens

@torch.no_grad()
def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, total_tokens = 0.0, 0
    for X_ev, X_dt, X_flags, y in loader:
        X_ev, X_dt, X_flags, y = (
            X_ev.to(device), X_dt.to(device), X_flags.to(device), y.to(device)
        )
        x_cont = torch.cat([X_dt, X_flags], dim=-1)
        logits = model(X_ev, x_cont)
        loss = criterion(logits.reshape(-1, logits.size(-1)), y.reshape(-1))
        total_loss   += loss.item() * y.numel()
        total_tokens += y.numel()
    return total_loss / total_tokens

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config',   default='config.yaml')
    parser.add_argument('--data-dir', default=None)
    args = parser.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get('seed', 42))

    data_dir  = Path(args.data_dir or cfg['artifacts']['dataset_dir'])
    model_dir = Path(cfg['artifacts']['model_dir'])
    model_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"[Train] Using device: {device}")

    # Load datasets
    train_ds = SessionDataset(data_dir / 'dataset_train.npz')
    val_ds   = SessionDataset(data_dir / 'dataset_val.npz')

    mcfg = cfg['model']
    tcfg = cfg['training']

    train_loader = DataLoader(train_ds, batch_size=tcfg['batch_size'], shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=tcfg['batch_size'], shuffle=False, num_workers=0)

    print(f"[Train] Train: {len(train_ds)} | Val: {len(val_ds)} samples")
    print(f"[Train] Input: embedding({mcfg['embedding_dim']}) + extra({mcfg.get('extra_dim', 6)}) → LSTM hidden({mcfg['lstm_hidden']})")

    # Model
    model = LSTMNextEventModel(
        vocab_size    = mcfg['vocab_size'],
        embedding_dim = mcfg['embedding_dim'],
        extra_dim     = mcfg.get('extra_dim', 6),
        hidden_size   = mcfg['lstm_hidden'],
        num_layers    = mcfg['lstm_layers'],
        dropout       = mcfg['dropout'],
    ).to(device)

    param_count = sum(p.numel() for p in model.parameters())
    print(f"[Train] Model parameters: {param_count:,}")

    optimizer = optim.AdamW(model.parameters(), lr=tcfg['learning_rate'], weight_decay=tcfg['weight_decay'])
    criterion = nn.CrossEntropyLoss(ignore_index=19)  # ignore PAD

    best_val_loss    = float('inf')
    patience_counter = 0
    history          = []

    for epoch in range(1, tcfg['epochs'] + 1):
        train_loss = train_epoch(model, train_loader, optimizer, criterion, device)
        val_loss   = eval_epoch(model, val_loader, criterion, device)

        history.append({'epoch': epoch, 'train_loss': train_loss, 'val_loss': val_loss})
        print(f"Epoch {epoch:3d}/{tcfg['epochs']} | train_loss={train_loss:.4f} | val_loss={val_loss:.4f}")

        if val_loss < best_val_loss:
            best_val_loss    = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), model_dir / 'best_model.pt')
            print(f"  → Best model saved (val_loss={val_loss:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= tcfg['patience']:
                print(f"[Train] Early stopping at epoch {epoch}")
                break

    # Save final + metadata
    torch.save(model.state_dict(), model_dir / 'last_model.pt')

    meta = {
        'best_val_loss':   best_val_loss,
        'epochs_trained':  len(history),
        'model_config':    mcfg,
        'training_config': tcfg,
        'history':         history,
        'device':          str(device),
        'created_at':      datetime.utcnow().isoformat(),
        'seed':            cfg.get('seed', 42),
        'multimodal':      True,
        'extra_dim':       mcfg.get('extra_dim', 6),
    }
    with open(model_dir / 'training_metrics.json', 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"\n[Train] Done. Best val_loss={best_val_loss:.4f}")
    print(f"[Train] Artifacts saved to {model_dir}/")
    print(f"[Train] NOTE: Run score_batch.py to recalibrate thresholds after training.")

if __name__ == '__main__':
    main()
