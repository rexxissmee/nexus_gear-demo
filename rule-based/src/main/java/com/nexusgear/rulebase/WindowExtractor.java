package com.nexusgear.rulebase;

import org.json.JSONObject;

import java.sql.*;
import java.util.*;

/**
 * WindowExtractor – Đọc session_events từ PostgreSQL và tạo sliding windows.
 *
 * Mỗi window gồm L events liên tiếp trong cùng 1 session.
 * Output: List<Window>, mỗi Window chứa session_id và danh sách EventRecord.
 */
public class WindowExtractor {

    private final String dbUrl;
    private final int windowLength;
    private final int stride;
    private final int minSessionLength;

    public WindowExtractor(String dbUrl, int windowLength, int stride, int minSessionLength) {
        this.dbUrl = dbUrl;
        this.windowLength = windowLength;
        this.stride = stride;
        this.minSessionLength = minSessionLength;
    }

    /**
     * Đại diện cho 1 event trong DB.
     */
    public static class EventRecord {
        public final String sessionId;
        public final String eventType;
        public final int deltaTMs;
        public final JSONObject flags;
        public final JSONObject metrics;
        public final Timestamp ts;

        public EventRecord(String sessionId, String eventType, int deltaTMs,
                           String flagsJson, String metricsJson, Timestamp ts) {
            this.sessionId = sessionId;
            this.eventType = eventType;
            this.deltaTMs = deltaTMs;
            this.flags = flagsJson != null ? new JSONObject(flagsJson) : new JSONObject();
            this.metrics = metricsJson != null ? new JSONObject(metricsJson) : new JSONObject();
            this.ts = ts;
        }
    }

    /**
     * Đại diện cho 1 window (chuỗi events liên tiếp trong session).
     */
    public static class Window {
        public final String sessionId;
        public final int windowIndex;
        public final List<EventRecord> events;

        public Window(String sessionId, int windowIndex, List<EventRecord> events) {
            this.sessionId = sessionId;
            this.windowIndex = windowIndex;
            this.events = events;
        }
    }

    /**
     * Bước 1: Đọc toàn bộ session_events từ DB, sắp xếp theo session + timestamp.
     */
    public List<EventRecord> fetchAllEvents() throws SQLException {
        List<EventRecord> events = new ArrayList<>();

        String sql = """
            SELECT se.session_id, se.event_type, se.delta_t_ms,
                   se.flags::text, se.metrics::text, se.ts
            FROM session_events se
            JOIN sessions s ON se.session_id = s.session_id
            ORDER BY se.session_id, se.ts
            """;

        try (Connection conn = DriverManager.getConnection(dbUrl);
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                events.add(new EventRecord(
                    rs.getString("session_id"),
                    rs.getString("event_type"),
                    rs.getInt("delta_t_ms"),
                    rs.getString("flags"),
                    rs.getString("metrics"),
                    rs.getTimestamp("ts")
                ));
            }
        }

        System.out.printf("[WindowExtractor] Loaded %d events from DB%n", events.size());
        return events;
    }

    /**
     * Bước 2: Nhóm events theo session_id.
     */
    public Map<String, List<EventRecord>> groupBySession(List<EventRecord> events) {
        Map<String, List<EventRecord>> grouped = new LinkedHashMap<>();
        for (EventRecord e : events) {
            grouped.computeIfAbsent(e.sessionId, k -> new ArrayList<>()).add(e);
        }
        System.out.printf("[WindowExtractor] Found %d sessions%n", grouped.size());
        return grouped;
    }

    /**
     * Bước 3: Tạo sliding windows cho tất cả sessions.
     *
     * Cách hoạt động:
     * - Với mỗi session có N events (N >= minSessionLength):
     *   - Tạo windows bắt đầu từ index 0, 0+stride, 0+2*stride, ...
     *   - Mỗi window chứa đúng windowLength events liên tiếp
     *   - Nếu session ngắn hơn windowLength: bỏ qua session đó
     */
    public List<Window> createWindows(List<EventRecord> allEvents) {
        Map<String, List<EventRecord>> sessions = groupBySession(allEvents);
        List<Window> windows = new ArrayList<>();

        for (Map.Entry<String, List<EventRecord>> entry : sessions.entrySet()) {
            String sessionId = entry.getKey();
            List<EventRecord> sessionEvents = entry.getValue();

            if (sessionEvents.size() < minSessionLength) {
                continue; // Session quá ngắn, bỏ qua
            }

            int windowIdx = 0;
            for (int start = 0; start <= sessionEvents.size() - windowLength; start += stride) {
                List<EventRecord> windowEvents = sessionEvents.subList(start, start + windowLength);
                windows.add(new Window(sessionId, windowIdx, new ArrayList<>(windowEvents)));
                windowIdx++;
            }
        }

        System.out.printf("[WindowExtractor] Created %d windows (L=%d, stride=%d)%n",
                windows.size(), windowLength, stride);
        return windows;
    }
}
