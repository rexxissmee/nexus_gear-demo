package com.nexusgear.rulebase;

import java.util.*;

/**
 * RuleEngine – Tính anomaly score cho mỗi window dựa trên rule tĩnh.
 *
 * Cách hoạt động (Baseline so sánh với LSTM):
 * - Duyệt từng event trong window
 * - Cộng điểm khi gặp event/flag bất thường:
 *   FLAG_IP_CHANGE  → +2.0  (IP thay đổi giữa chừng = nghi ngờ cao)
 *   FLAG_UA_CHANGE  → +1.5  (User-Agent thay đổi)
 *   FLAG_DEVICE_CHANGE → +2.5  (thiết bị thay đổi)
 *   FLAG_GEO_CHANGE → +1.5  (vị trí địa lý thay đổi)
 *   STATUS_401      → +1.0  (unauthorized request)
 *   STATUS_403      → +1.2  (forbidden request)
 *   REQUEST_BURST   → +1.8  (flood request bất thường)
 *   API_CALL_SENSITIVE → +1.5 (gọi API nhạy cảm)
 *
 * - Window score = tổng điểm / số events (trung bình)
 *
 * Ưu điểm: Đơn giản, giải thích được, không cần training.
 * Nhược điểm: Không bắt được pattern phức tạp (thứ tự events, timing).
 */
public class RuleEngine {

    // Scoring weights (configurable via Properties)
    private final double wIpChange;
    private final double wUaChange;
    private final double wDeviceChange;
    private final double wGeoChange;
    private final double wStatus401;
    private final double wStatus403;
    private final double wReqBurst;
    private final double wSensitive;

    public RuleEngine(Properties config) {
        this.wIpChange     = Double.parseDouble(config.getProperty("rule.weight.ip_change", "2.0"));
        this.wUaChange     = Double.parseDouble(config.getProperty("rule.weight.ua_change", "1.5"));
        this.wDeviceChange = Double.parseDouble(config.getProperty("rule.weight.device_change", "2.5"));
        this.wGeoChange    = Double.parseDouble(config.getProperty("rule.weight.geo_change", "1.5"));
        this.wStatus401    = Double.parseDouble(config.getProperty("rule.weight.status_401", "1.0"));
        this.wStatus403    = Double.parseDouble(config.getProperty("rule.weight.status_403", "1.2"));
        this.wReqBurst     = Double.parseDouble(config.getProperty("rule.weight.req_burst", "1.8"));
        this.wSensitive    = Double.parseDouble(config.getProperty("rule.weight.api_sensitive", "1.5"));
    }

    /**
     * Tính score cho 1 event dựa trên event_type và flags.
     */
    public double scoreEvent(WindowExtractor.EventRecord event) {
        double score = 0.0;

        boolean hasIpChange = (event.eventType.equals("FLAG_IP_CHANGE") || event.flags.optInt("ip_change", 0) > 0);
        boolean hasUaChange = (event.eventType.equals("FLAG_UA_CHANGE") || event.flags.optInt("ua_change", 0) > 0);
        boolean hasDeviceChange = (event.eventType.equals("FLAG_DEVICE_CHANGE") || event.flags.optInt("device_change", 0) > 0);
        boolean hasGeoChange = (event.eventType.equals("FLAG_GEO_CHANGE") || event.flags.optInt("geo_change", 0) > 0);

        if (hasIpChange) score += wIpChange;
        if (hasUaChange) score += wUaChange;
        if (hasDeviceChange) score += wDeviceChange;
        if (hasGeoChange) score += wGeoChange;

        if (event.eventType.equals("STATUS_401")) score += wStatus401;
        if (event.eventType.equals("STATUS_403")) score += wStatus403;
        if (event.eventType.equals("REQUEST_BURST")) score += wReqBurst;
        if (event.eventType.equals("API_CALL_SENSITIVE")) score += wSensitive;

        return score;
    }

    /**
     * Tính score cho toàn bộ window = trung bình score các events.
     */
    public double scoreWindow(WindowExtractor.Window window) {
        double totalScore = 0.0;
        for (WindowExtractor.EventRecord event : window.events) {
            totalScore += scoreEvent(event);
        }
        // Trả về trung bình (giống LSTM: mean of step scores)
        return totalScore / window.events.size();
    }

    /**
     * Tính score cho tất cả windows.
     */
    public List<WindowScore> scoreAll(List<WindowExtractor.Window> windows) {
        List<WindowScore> results = new ArrayList<>();
        for (WindowExtractor.Window w : windows) {
            double score = scoreWindow(w);
            results.add(new WindowScore(w.sessionId, w.windowIndex, score));
        }
        System.out.printf("[RuleEngine] Scored %d windows%n", results.size());
        return results;
    }

    /**
     * Kết quả score cho 1 window.
     */
    public static class WindowScore {
        public final String sessionId;
        public final int windowIndex;
        public final double score;

        public WindowScore(String sessionId, int windowIndex, double score) {
            this.sessionId = sessionId;
            this.windowIndex = windowIndex;
            this.score = score;
        }
    }
}
