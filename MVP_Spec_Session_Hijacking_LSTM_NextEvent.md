# MVP Spec – Công cụ phát hiện chiếm phiên (Session Hijacking/Replay) bằng LSTM (Next‑Event Prediction)

> Mục tiêu: đặc tả **tính năng** + **phạm vi triển khai** cho đồ án MVP  

---

## 1. Mục tiêu sản phẩm (Product Goals)

### 1.1. Mục tiêu chính
- Phát hiện hành vi **chiếm phiên / session replay** dựa trên **chuỗi sự kiện** của phiên.
- Sử dụng **LSTM self-supervised** theo biến thể **Next‑event prediction**:
  - học trên **phiên bình thường** (normal sessions)
  - suy luận tạo **anomaly score** để kích hoạt **cảnh báo / step‑up / revoke**

### 1.2. Mục tiêu phụ
- Tạo được **pipeline dữ liệu** từ web app → log → dataset → train → evaluate → deploy inference.
- Cung cấp **dashboard/report** tối thiểu để chứng minh hiệu quả:
  - false positives (FP) trên normal
  - khả năng phát hiện (recall/detection rate) trên tập tấn công có nhãn (từ dữ liệu lab/harness đã có)

---

## 2. Phạm vi MVP (Scope)

### 2.1. Có trong MVP
1) **Web demo app** (môi trường tạo session events)
- Đăng nhập bằng:
  - Password (baseline)
  - Passkey/WebAuthn (tuỳ mức độ triển khai, ưu tiên demo được luồng)
- Có session management & “session defense” tối thiểu:
  - token/session rotation (bật/tắt)
  - revoke session/token
  - step-up authentication khi bị đánh rủi ro

2) **Telemetry & Logging (non‑PII)**
- Ghi log sự kiện theo session, không lưu dữ liệu định danh nhạy cảm.
- Chuẩn hoá event thành “bộ từ vựng” (event vocabulary) phục vụ mô hình.

3) **Feature pipeline**
- Chuyển log thô → sequence dataset (windowing) phục vụ huấn luyện LSTM.

4) **Training pipeline (offline)**
- Huấn luyện LSTM dự đoán sự kiện kế tiếp (và tuỳ chọn dự đoán thời gian kế tiếp).
- Lưu model + metadata (vocab, scaler, version).

5) **Evaluation scripts**
- Sinh anomaly score cho tập test
- Tính các chỉ số tối thiểu: ROC/PR, FPR@threshold, time‑to‑detect

6) **Inference service + Policy engine**
- Nhận stream sự kiện hoặc batch window → trả risk/anomaly score
- Policy: warn / step‑up / revoke dựa trên ngưỡng + cơ chế giảm nhiễu (EMA + consecutive windows)

7) **Dashboard/Report tối thiểu**
- Trang tổng hợp hoặc báo cáo xuất file:
  - số lượng sessions, alerts, FP, step‑ups, revokes
  - phân phối anomaly score
  - so sánh baseline rule-based vs LSTM (nếu có)

### 2.2. Không có trong MVP (Non‑Goals)
- Không tối ưu hoá cho production (HA, autoscaling, multi‑tenant).
- Không thu thập dữ liệu PII (IP/UA đầy đủ, nội dung request, credential…).
- Không triển khai đầy đủ bộ cơ chế phòng thủ doanh nghiệp (WAF, device fingerprinting nâng cao, SIEM integration…).

---

## 3. Kiến trúc tổng quan (High‑Level Architecture)

```
[Web App] 
   |  (events)
   v
[Event Collector / Logger]  --->  [Event Store (JSONL/DB)]
   |                                   |
   | (batch export)                     | (batch)
   v                                   v
[Feature Builder + Windowing]  --->  [Dataset (train/val/test)]
   |
   v
[Trainer (LSTM Next-event)]  --->  [Model Registry (artifacts)]
   |
   v
[Scoring/Inference Service] <--- [Web App runtime calls]
   |
   v
[Policy Engine] ---> warn / step-up / revoke
   |
   v
[Dashboard/Report]
```

---

## 4. Module/Tính năng chi tiết

### 4.1. Web demo app (tối thiểu để tạo sự kiện)
**Tính năng**
- Đăng nhập/đăng xuất
- Giao diện thao tác “bình thường” (xem thông tin, đổi cài đặt, thao tác nhạy cảm)
- Session management:
  - cấp session/token
  - refresh/rotate token (config bật/tắt)
  - revoke session/token (manual + tự động qua policy)

**Acceptance criteria**
- Người dùng thực hiện được một “flow” hoàn chỉnh: login → thao tác → logout
- Hệ thống sinh được event log đầy đủ theo session.

---

### 4.2. Event vocabulary & Schema logging (non‑PII)
#### 4.2.1. Event vocabulary (gợi ý tối thiểu)
- `AUTH_LOGIN_SUCCESS`, `AUTH_LOGOUT`
- `TOKEN_ISSUE`, `TOKEN_REFRESH`, `TOKEN_ROTATE`, `TOKEN_REVOKE`
- `API_CALL_NORMAL`, `API_CALL_SENSITIVE`
- `FLAG_IP_CHANGE`, `FLAG_UA_CHANGE`, `FLAG_DEVICE_CHANGE`, `FLAG_GEO_CHANGE`
- `STATUS_401`, `STATUS_403`
- `SESSION_IDLE_LONG`, `REQUEST_BURST`

> Lưu ý: thay vì lưu IP/UA thật, chỉ lưu **flag thay đổi** hoặc các bucket/statistics.

#### 4.2.2. Event schema (JSON) – đề xuất
```json
{
  "ts": "2026-02-27T09:15:30.123Z",
  "session_id": "sess_abc123",
  "user_pseudo_id": "u_7f3a...", 
  "event_type": "TOKEN_REFRESH",
  "delta_t_ms": 8200,
  "flags": {
    "ip_change": 0,
    "ua_change": 0,
    "device_change": 0,
    "geo_change": 0,
    "cookie_missing": 0
  },
  "metrics": {
    "req_rate_10s": 3,
    "endpoint_group": "profile",
    "status_group": "2xx"
  },
  "config": {
    "rotation_enabled": true,
    "passkey_enabled": false
  }
}
```

**Acceptance criteria**
- Event log không chứa PII/secret (không token raw, không password, không full IP/UA).
- Event log đủ để xây feature: event_type + delta_t + flags + metrics tối thiểu.

---

### 4.3. Feature Builder + Windowing
**Tính năng**
- Parser đọc event store (JSONL/DB) → nhóm theo `session_id`
- Chuẩn hoá:
  - map `event_type` → `event_type_id` (vocab)
  - transform `delta_t_ms` → `log(1 + delta_t_ms)`
  - flags → vector 0/1
  - metrics (bucket hoá nếu cần)
- Windowing:
  - window length `L` (vd 30–50)
  - stride (vd 1–5)
  - tạo dataset:
    - `X`: sequence features cho t=1..L-1
    - `y_event`: event_id cho t=2..L
    - (optional) `y_dt`: delta_t cho t=2..L

**Acceptance criteria**
- Xuất dataset (Parquet/NPZ) + metadata (vocab.json, config.yaml)
- Reproducible: cùng input log → cùng dataset (seed, version).

---

### 4.4. Training (LSTM Next‑Event Prediction)
**Tính năng**
- Training trên **normal sessions** (self-supervised):
  - Input: `x1..xt`
  - Target: `event_{t+1}` (+ optional `delta_{t+1}`)
- Model:
  - Event embedding (32–128)
  - LSTM 1–2 layer (hidden 128–256)
  - Head classification: softmax over |V|
  - Head regression (optional): dự đoán delta_t
- Loss:
  - `CE(next_event)` + `λ * Huber(next_delta_t)` (tuỳ chọn)
- Lưu artifacts:
  - model weights
  - vocab + preprocess config
  - training metrics + seed

**Acceptance criteria**
- Train chạy end‑to‑end trên dataset MVP
- Có checkpoint tốt nhất theo val loss.

---

### 4.5. Scoring – Anomaly score (runtime & batch)
**Tính năng**
- Step score:
  - `s_evt(t) = -log P(true_next_event | history)`
  - (optional) `s_time(t) = |dt_true - dt_pred|` (chuẩn hoá)
  - `s(t) = s_evt(t) + α * s_time(t)`
- Window score:
  - `S_window = mean(s(t))` hoặc `max(s(t))`
- Session risk smoothing:
  - EMA: `R_t = β R_{t-1} + (1-β) S_window`

**Acceptance criteria**
- Với session bình thường, phân phối `R_t` ổn định (không “nổ” liên tục).
- Batch scoring xuất được bảng/CSV: session_id, time, score, decision.

---

### 4.6. Thresholding & Policy Engine
**Tính năng**
- Threshold calibration từ **validation normal**:
  - `T_warn = P99(R)`
  - `T_block = P99.9(R)`
- Policy chống false positives:
  - warn/step‑up nếu `R_t > T_warn` trong **2 windows liên tiếp**
  - revoke nếu `R_t > T_block` trong **3 windows liên tiếp**
- Hành động:
  - `WARN`: hiển thị cảnh báo (UI) hoặc log
  - `STEP_UP`: yêu cầu xác minh thêm (re‑auth / passkey)
  - `REVOKE`: revoke session/token, bắt login lại

**Acceptance criteria**
- Có config để thay đổi thresholds, consecutive count, EMA β
- Hành động policy được ghi log (audit trail).

---

### 4.7. Inference service (API) – tối thiểu
**Tính năng**
- Endpoint nhận event:
  - `POST /event` (push từng event) hoặc `POST /score` (push window)
- Trả về:
  - `anomaly_score` (current)
  - `risk_ema` (R_t)
  - `decision`: NONE/WARN/STEP_UP/REVOKE
  - `reason`: top‑k “surprising events” (tuỳ chọn, để giải thích)

**Acceptance criteria**
- Web app gọi API và nhận decision real‑time
- Không làm lộ dữ liệu nhạy cảm qua API responses.

---

### 4.8. Dashboard/Report tối thiểu
**Tính năng**
- Thống kê:
  - tổng session, số alert/step-up/revoke
  - phân phối risk score (histogram đơn giản)
  - FPR ước tính trên normal
- Export:
  - CSV/JSON report phục vụ viết báo cáo đồ án

**Acceptance criteria**
- Xuất được report 1 lần chạy (run_id) kèm config & model_version.

---

## 5. Đánh giá (Evaluation) cho đồ án
> Dù hướng 2 train không cần nhãn, vẫn **đánh giá** trên tập có nhãn tấn công (từ dữ liệu lab/harness đã có).

**Chỉ số tối thiểu**
- FPR trên normal (tỷ lệ windows/sessions vượt ngưỡng)
- Detection rate / recall trên attack sessions
- Time‑to‑detect (số events hoặc thời gian đến khi vượt `T_warn` / `T_block`)
- PR‑AUC/ROC‑AUC (dùng risk score)

**Baseline để so sánh (khuyến nghị)**
- Rule-based: ip_change + token_refresh bất thường + burst + 401/403 spike

---

## 6. Bảo mật & đạo đức (Ethics by Design)
- **Non‑PII logging**: không lưu token raw, password, full IP/UA.
- Pseudonymous user/session id.
- Retention policy: log được xoá sau N ngày (config).
- Access control cho event store & model artifacts.
- Audit log cho mọi hành động revoke/step‑up.

---

## 7. Kế hoạch triển khai MVP (gợi ý milestone)
1) **M1 – Logging + Vocabulary**
- Web app sinh event, lưu event store

2) **M2 – Feature Builder + Dataset**
- Windowing, xuất dataset + metadata

3) **M3 – Train LSTM + Batch Scoring**
- Train, lưu model, chạy scoring batch, có phân phối score

4) **M4 – Threshold + Policy**
- Calibration thresholds, implement decision logic + audit log

5) **M5 – Inference API + Integrate Web**
- Web app gọi scoring, hiển thị warn/step‑up, revoke hoạt động

6) **M6 – Dashboard/Report + Evaluation**
- Report + biểu đồ tối thiểu, so sánh baseline

---

## 8. Deliverables (đầu ra)
- Source code repo (modules rõ ràng)
- `spec.md` (tài liệu này)
- Sample dataset artifacts (vocab.json, config.yaml, dataset files)
- Model artifacts (weights + version)
- Report kết quả (CSV/figures) phục vụ viết luận/báo cáo

---

## 9. Checklist nhanh cho MVP
- [ ] Event schema ổn định, non‑PII
- [ ] Dataset windowing chạy được
- [ ] LSTM train/val có loss giảm
- [ ] Risk score phân phối hợp lý trên normal
- [ ] Thresholds P99/P99.9 + consecutive windows + EMA
- [ ] Policy actions: warn / step‑up / revoke hoạt động
- [ ] Report xuất được, có số liệu đánh giá

