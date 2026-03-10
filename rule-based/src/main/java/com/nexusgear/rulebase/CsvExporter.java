package com.nexusgear.rulebase;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * CsvExporter – Xuất kết quả Rule-Based scores ra file CSV.
 *
 * Format CSV khớp với Python score_batch.py output:
 *   session_id, window_idx, rule_score
 *
 * File này sẽ được Python evaluate.py đọc để vẽ ROC/PR so sánh.
 */
public class CsvExporter {

    private final String outputDir;
    private final String filename;

    public CsvExporter(String outputDir, String filename) {
        this.outputDir = outputDir;
        this.filename = filename;
    }

    /**
     * Xuất danh sách WindowScore ra CSV.
     * Tạo thư mục output nếu chưa có.
     */
    public Path export(List<RuleEngine.WindowScore> scores) throws IOException {
        Path dir = Paths.get(outputDir);
        Files.createDirectories(dir);

        Path filePath = dir.resolve(filename);

        try (BufferedWriter writer = Files.newBufferedWriter(filePath)) {
            // Header
            writer.write("session_id,window_idx,rule_score");
            writer.newLine();

            // Data rows
            for (RuleEngine.WindowScore ws : scores) {
                writer.write(String.format("%s,%d,%.4f",
                        ws.sessionId, ws.windowIndex, ws.score));
                writer.newLine();
            }
        }

        System.out.printf("[CsvExporter] Exported %d rows → %s%n", scores.size(), filePath.toAbsolutePath());
        return filePath;
    }

    /**
     * Xuất summary thống kê vào console.
     */
    public static void printSummary(List<RuleEngine.WindowScore> scores) {
        if (scores.isEmpty()) {
            System.out.println("[Summary] No windows to score.");
            return;
        }

        double min = scores.stream().mapToDouble(s -> s.score).min().orElse(0);
        double max = scores.stream().mapToDouble(s -> s.score).max().orElse(0);
        double mean = scores.stream().mapToDouble(s -> s.score).average().orElse(0);
        long nonZero = scores.stream().filter(s -> s.score > 0).count();

        System.out.println("\n=== Rule-Based Scoring Summary ===");
        System.out.printf("  Total windows:    %d%n", scores.size());
        System.out.printf("  Non-zero scores:  %d (%.1f%%)%n", nonZero, 100.0 * nonZero / scores.size());
        System.out.printf("  Score range:      [%.4f, %.4f]%n", min, max);
        System.out.printf("  Mean score:       %.4f%n", mean);
        System.out.printf("  Timestamp:        %s%n",
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }
}
