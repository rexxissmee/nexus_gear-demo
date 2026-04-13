# Nexus Gear Demo - Session Hijacking Detection

Welcome to **Nexus Gear Demo**, a project that provides a multi-layered Session Hijacking detection system, combining **Machine Learning (LSTM)** and a **Rule-based Baseline**.

---

## 🏗️ Project Architecture Overview

The project is divided into 3 main modules:

### 1. Web Application & Dashboard (Next.js)
- Root directory (`/app`, `/components`, `/prisma`, ...)
- Provides an admin Dashboard, manages active sessions, and simulates Attack Scenarios.
- **Tech stack:** Next.js (TypeScript), Tailwind CSS, Prisma ORM, PostgreSQL.
- **Status:** Running via `pnpm dev`.

### 2. Machine Learning Engine (`/ml`)
- An AI module that detects anomalous behaviors and triggers access control based on probabilities.
- Complete pipeline:
  - `label_builder.py`: Extracts attack labels from the database.
  - `feature_builder.py`: Extracts features (events, delta time, flags) and generates sliding windows.
  - `train.py`: Trains the Multimodal LSTM model using PyTorch.
  - `score_batch.py`: Runs batch inference and automatically calibrates the Warning (`STEP_UP`) & Revocation (`REVOKE`) thresholds.
  - `evaluate.py`: Exports comprehensive reports and confusion matrix charts to analyze accuracy.
- **Tech stack:** Python, PyTorch, Pandas, Numpy, Scikit-learn.

### 3. Rule-Based Baseline Engine (`/rule-based`)
- A baseline comparison system relying on static, human-programmed logic.
- Fetches logs from the database and calculates anomalous scores using fixed weights (e.g., changing IP, missing cookies, ...).
- Used to benchmark the ML model's detection performance and configure confidence levels.
- **Tech stack:** Java 24, Maven, JDBC.

---

## 🚀 Setup & Execution Guide

### System Requirements
- Node.js & pnpm.
- Python 3.10+
- Java (JDK) 24 & Maven (if you wish to rebuild the rule-based module).
- PostgreSQL Database (See URL in the `.env` file).

### Launching the Web App
```bash
# Install Node dependencies
pnpm install

# Start the development server
pnpm dev
```
Access via browser: `http://localhost:3000`

### Retraining the ML Model (Retrain Pipeline)
Navigate to the `ml/` directory and run the pipeline sequentially:
```bash
# Set the environment variable to avoid UTF-8 errors on Windows PowerShell
$env:PYTHONIOENCODING="utf-8"

# M1 - Build Labels
python label_builder.py

# M2 - Build features dataset in sliding windows format
python feature_builder.py --split all

# M3 - Train the LSTM model
python train.py

# M4 - Calibrate thresholds
python score_batch.py --split val

# Evaluate & Export comparison report (ML vs Rule-Based)
python evaluate.py
```

### Rebuilding the Base Module (Java)
Navigate to the `rule-based/` directory:
```bash
mvn clean package
```

---

## 📊 Evaluation & Metrics
Nexus Gear Demo outperforms traditional methods:
- The **LSTM (ML)** system operates with high confidence and significantly reduces **False Positives** compared to the **Rule-based** baseline.
- Enables automated **Step-Up Authentication** (triggering MFA automatically when the risk level approaches a critical threshold).

---
*A research project by Nexus Gear - Building next-generation session protection scenarios.*
