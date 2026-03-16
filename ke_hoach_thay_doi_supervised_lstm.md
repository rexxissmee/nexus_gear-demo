# Kế hoạch thay đổi cần triển khai khi chuyển AI sang supervised learning

> Dự án: **Phát hiện chiếm phiên / session hijacking bằng LSTM**  
> Mục tiêu tài liệu này: liệt kê rõ các thay đổi cần triển khai theo **cấu trúc repo hiện tại**, để chuyển từ hướng **anomaly / next-event prediction** sang **supervised sequence classification có gắn nhãn**.

---

## 1. Mục tiêu thay đổi

Hiện tại hệ thống đang có đầy đủ:
- web app demo
- telemetry / event logging
- session protection
- score route
- policy engine
- dashboard an ninh
- pipeline ML cơ bản

Thay đổi lần này **không phải viết lại toàn bộ hệ thống**, mà là:

- giữ nguyên **web app + telemetry + policy flow**
- thay lớp AI từ:
  - **sequence anomaly / next-event style**
- sang:
  - **supervised sequence classification có nhãn**

Kết quả mong muốn:
- model trả về **xác suất ATTACK**
- hệ thống ánh xạ xác suất đó sang:
  - `WARN`
  - `STEP_UP`
  - `REVOKE`

---

## 2. Định hướng triển khai được khuyến nghị

### 2.1. Chọn bài toán giai đoạn đầu
Triển khai trước theo **binary classification**:

- `0 = NORMAL`
- `1 = ATTACK`

Lý do:
- dễ gắn nhãn hơn
- dễ train hơn
- dễ đánh giá hơn
- phù hợp với khối lượng dữ liệu hiện tại

### 2.2. Mở rộng sau khi ổn định
Sau khi binary hoạt động ổn:
- `NORMAL`
- `SUSPICIOUS`
- `HIJACK_REPLAY`

### 2.3. Mức gắn nhãn nên dùng
Khuyến nghị dùng **window-level label**.

Mỗi session được cắt thành các cửa sổ `L` bước.  
Mỗi window có nhãn:
- `NORMAL`
- hoặc `ATTACK`

Lý do:
- phù hợp với runtime scoring
- hỗ trợ tính **time-to-detect**
- tương thích tốt với policy engine hiện tại

---

## 3. Những phần giữ nguyên

Các module dưới đây **không cần thay đổi kiến trúc**:

### 3.1. Web app và auth
- luồng login password
- luồng passkey/WebAuthn
- UI step-up
- session management page

### 3.2. Session protection
- refresh token / session refresh
- token rotation
- revoke session
- session ownership checks
- revoked-session detection

### 3.3. Telemetry nền tảng
- event schema
- event vocabulary
- event persistence route
- audit logging

### 3.4. Runtime flow tổng thể
Luồng tổng thể vẫn giữ nguyên:

1. web app sinh event  
2. event được persist  
3. score route gọi AI  
4. AI trả `risk_score`  
5. policy engine quyết định `WARN / STEP_UP / REVOKE`

Điểm thay đổi chỉ là:
- **nguồn gốc risk_score**
- **cách train model**
- **bộ metrics đánh giá**

---

## 4. Những phần bắt buộc phải thay đổi

### 4.1. Thêm pipeline gắn nhãn dữ liệu

#### Mục tiêu
Sinh dữ liệu có nhãn từ event logs hiện tại.

#### Việc cần làm
Tạo mới một module như:
- `ml/label_builder.py`

Hoặc gộp vào:
- `ml/feature_builder.py`

#### Nhiệm vụ của bước gắn nhãn
- đọc event logs theo `session_id`
- lấy marker hoặc metadata từ các phiên lab
- gắn nhãn:
  - `NORMAL`
  - `ATTACK`
- hỗ trợ gắn nhãn ở mức:
  - session-level
  - window-level

#### Nguồn nhãn
Nhãn nên lấy từ các nguồn sau:

**A. Ground-truth từ kịch bản kiểm soát**
- session bình thường
- session có replay token
- session hijack có kiểm soát

**B. Marker trong event stream**
- token replay marker
- suspicious revoke marker
- reuse marker
- session compromise marker

**C. Manual review**
Dùng cho các session khó hoặc nhiễu.

#### Output đề xuất
- `labels_session.json`
- `labels_window.npy`
- `label_map.json`
- `dataset_manifest.json`

---

### 4.2. Cập nhật `ml/feature_builder.py`

#### Mục tiêu
Xuất dataset cho supervised classification thay vì anomaly-only pipeline.

#### Input giữ nguyên
Tiếp tục tận dụng:
- `event_type_id`
- `delta_t`
- `flags`
- các metrics hiện có

#### Output mới cần có
- `X_events.npy`
- `X_dt.npy`
- `X_flags.npy`
- `y.npy`
- `session_ids.json`
- `split.json`
- `label_map.json`

#### Yêu cầu split dữ liệu
Phải split theo **session**, không split ngẫu nhiên theo window.

Khuyến nghị:
- train: 70%
- val: 15%
- test: 15%

Nếu có nhiều session từ cùng một run/kịch bản, nên group trước khi split để tránh leakage.

#### Quy tắc gắn nhãn window
Ví dụ với cửa sổ `L = 30`:
- window trước marker attack → `NORMAL`
- window chứa hoặc sau marker attack → `ATTACK`

---

### 4.3. Cập nhật `ml/train.py`

#### Mục tiêu
Đổi từ huấn luyện next-event / anomaly style sang **classification**.

#### Kiến trúc mới
Giữ backbone LSTM, đổi head như sau:

1. embedding cho `event_type_id`
2. ghép với:
   - `delta_t`
   - `flags`
3. đưa qua LSTM
4. lấy hidden cuối hoặc pooled hidden
5. classification head:
   - `Linear -> Sigmoid` cho binary
   - hoặc `Linear -> Softmax` cho multiclass

#### Loss function
Với binary classification:
- `BCEWithLogitsLoss`

Khuyến nghị thêm:
- `pos_weight` để xử lý mất cân bằng lớp

Nếu dữ liệu attack quá ít:
- dùng `Focal Loss`

#### Bắt buộc bổ sung
- early stopping
- best checkpoint saving
- training log theo epoch
- validation metrics theo epoch

#### Artifact cần lưu
- `best_model.pt`
- `train_config.json`
- `label_map.json`
- `thresholds.json`
- `metrics_val.json`

---

### 4.4. Cập nhật `ml/infer.py`

#### Mục tiêu
Infer phải trả ra **xác suất lớp**, không chỉ anomaly score.

#### Input
Giữ nguyên window features:
- `event_type`
- `delta_t`
- `flags`

#### Output mới
```json
{
  "predicted_label": "ATTACK",
  "class_probs": {
    "NORMAL": 0.21,
    "ATTACK": 0.79
  },
  "risk_score": 0.79
}
```

#### Quy ước
- `risk_score = P(ATTACK)`

Nhờ vậy:
- không phải viết lại nhiều ở runtime
- policy engine vẫn dùng logic risk quen thuộc

---

### 4.5. Cập nhật `app/api/security/score/route.ts`

#### Mục tiêu
Giữ vai trò score route, nhưng đọc output model theo dạng mới.

#### Trước đây
- route đọc anomaly score

#### Sau cập nhật
- route gọi `infer.py`
- nhận:
  - `predicted_label`
  - `class_probs`
  - `risk_score`

#### Response nên trả về
- `predicted_label`
- `class_probs`
- `risk_score`
- `decision`
- `reason` hoặc `top_signals` nếu có

---

### 4.6. Cập nhật `lib/policy-engine.ts`

#### Mục tiêu
Đổi từ anomaly threshold sang **probability threshold**.

#### Khuyến nghị threshold ban đầu
- `WARN` nếu `P(ATTACK) >= 0.50`
- `STEP_UP` nếu `P(ATTACK) >= 0.70`
- `REVOKE` nếu `P(ATTACK) >= 0.90`

#### Chống false positives
Giữ cơ chế làm mượt:
- cần 2 windows liên tiếp để `STEP_UP`
- cần 3 windows liên tiếp để `REVOKE`

Có thể dùng thêm:
- EMA / rolling average của `risk_score`

---

### 4.7. Cập nhật `ml/evaluate.py`

#### Mục tiêu
Đánh giá model bằng metric có nhãn.

#### Các metric bắt buộc
- confusion matrix
- precision
- recall
- F1-score
- ROC-AUC
- PR-AUC
- false positive rate
- false negative rate

#### Các metric nên có thêm
- session-level detection rate
- time-to-detect
- step-up rate
- revoke rate

#### Yêu cầu output
Xuất:
- `metrics_test.json`
- `confusion_matrix.png`
- `roc_curve.png`
- `pr_curve.png`
- `predictions.csv`

---

### 4.8. Cập nhật dashboard an ninh

#### Mục tiêu
Dashboard không chỉ hiển thị event vận hành, mà còn hiển thị kết quả supervised model.

#### Nên bổ sung
- confusion matrix
- precision / recall / F1 / FPR
- số session predicted normal vs attack
- top flagged sessions
- histogram `risk_score`
- so sánh:
  - rule-based baseline
  - LSTM supervised

---

## 5. Đề xuất file/module cần sửa theo cấu trúc hiện tại

### 5.1. Giữ nguyên
- `app/api/security/event/route.ts`
- `lib/event-logger.ts`
- `lib/session.ts`
- `app/api/auth/*`
- UI step-up / security profile pages

### 5.2. Cần sửa
- `ml/feature_builder.py`
- `ml/train.py`
- `ml/infer.py`
- `ml/evaluate.py`
- `app/api/security/score/route.ts`
- `lib/policy-engine.ts`
- dashboard security page

### 5.3. Nên thêm mới
- `ml/label_builder.py`
- `ml/metrics.py`
- `ml/thresholds.json`
- `ml/label_map.json`
- `ml/artifacts/`

---

## 6. Lộ trình triển khai theo giai đoạn

### Giai đoạn 1 — Chuẩn hoá nhãn
#### Công việc
- chốt binary classification
- định nghĩa rule gắn nhãn
- tạo script sinh nhãn
- kiểm tra chất lượng nhãn

#### Kết quả đầu ra
- dataset có nhãn đầu tiên
- file `label_map.json`
- file manifest mô tả dữ liệu

---

### Giai đoạn 2 — Cập nhật feature builder
#### Công việc
- sửa `feature_builder.py`
- tạo `X_events`, `X_dt`, `X_flags`, `y`
- split train/val/test theo session

#### Kết quả đầu ra
- dataset supervised dùng để train

---

### Giai đoạn 3 — Huấn luyện model
#### Công việc
- sửa `train.py`
- thêm classification head
- thêm BCEWithLogitsLoss + pos_weight
- thêm checkpoint / early stopping

#### Kết quả đầu ra
- `best_model.pt`
- training metrics
- validation metrics

---

### Giai đoạn 4 — Cập nhật inference runtime
#### Công việc
- sửa `infer.py`
- sửa `score route`
- trả `predicted_label + class_probs + risk_score`

#### Kết quả đầu ra
- runtime scoring hoạt động với model supervised

---

### Giai đoạn 5 — Cập nhật policy
#### Công việc
- đổi threshold
- tune decision logic
- kiểm tra false positives trong lab test

#### Kết quả đầu ra
- policy hoạt động ổn định với xác suất ATTACK

---

### Giai đoạn 6 — Đánh giá và dashboard
#### Công việc
- cập nhật `evaluate.py`
- xuất metric có nhãn
- thêm chart / confusion matrix
- cập nhật dashboard

#### Kết quả đầu ra
- dashboard hiển thị kết quả model rõ ràng
- có baseline comparison

---

## 7. Acceptance criteria

Hướng chuyển đổi được xem là hoàn thành khi đạt đủ:

1. event logs hiện tại sinh được dataset có nhãn  
2. `train.py` huấn luyện được classifier end-to-end  
3. `infer.py` trả được `P(ATTACK)`  
4. `score route` đọc được output mới  
5. `policy-engine` map được xác suất sang `WARN / STEP_UP / REVOKE`  
6. `evaluate.py` xuất confusion matrix + F1 + FPR  
7. dashboard hiển thị được kết quả supervised  

---

## 8. Thứ tự ưu tiên triển khai

### Ưu tiên 1
- tạo pipeline gắn nhãn
- cập nhật feature builder
- chốt binary classification

### Ưu tiên 2
- sửa trainer
- sửa infer
- sửa score route

### Ưu tiên 3
- sửa policy thresholds
- bổ sung evaluate metrics
- cập nhật dashboard

---

## 9. Khuyến nghị kỹ thuật cuối cùng

Để chuyển đổi nhanh và ít phá hệ thống nhất, nên chốt các quyết định sau:

- dùng **binary supervised classification** trước
- dùng **window-level labels**
- giữ quy ước:
  - `risk_score = P(ATTACK)`
- giữ nguyên toàn bộ runtime flow của sản phẩm
- chỉ thay:
  - data preparation
  - model head
  - evaluate metrics
  - threshold semantics

Cách làm này giúp:
- phù hợp với kiến trúc repo hiện tại
- không phải viết lại web app
- dễ triển khai hơn
- dễ viết report đánh giá hơn

