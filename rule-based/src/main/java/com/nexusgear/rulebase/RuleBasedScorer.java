package com.nexusgear.rulebase;

import io.github.cdimascio.dotenv.Dotenv;

import java.io.*;
import java.nio.file.Path;
import java.util.*;

/**
 * RuleBasedScorer – Main entry point.
 *
 * Pipeline:
 *   1. Đọc config từ config.properties
 *   2. Đọc DATABASE_URL từ ../.env (dotenv)
 *   3. WindowExtractor: DB → sliding windows
 *   4. RuleEngine: tính score cho mỗi window
 *   5. CsvExporter: xuất rule_based_scores.csv
 *
 * Chạy: java -jar target/rule-based-scorer-1.0-SNAPSHOT.jar
 *   hoặc: mvnw.cmd compile exec:java
 */
public class RuleBasedScorer {

    public static void main(String[] args) {
        System.out.println("╔══════════════════════════════════════════╗");
        System.out.println("║  Rule-Based Session Hijacking Scorer     ║");
        System.out.println("║  Baseline for comparison with LSTM       ║");
        System.out.println("╚══════════════════════════════════════════╝");

        try {
            // 1. Load config
            Properties config = loadConfig();
            System.out.println("[Config] Loaded config.properties");

            // 2. Load DB URL from .env
            String dbUrl = loadDatabaseUrl();
            System.out.printf("[Config] Database: %s...%n",
                    dbUrl.substring(0, Math.min(dbUrl.length(), 40)));

            // 3. Extract windows from DB
            int windowLength = Integer.parseInt(config.getProperty("window.length", "30"));
            int stride = Integer.parseInt(config.getProperty("window.stride", "5"));
            int minLen = Integer.parseInt(config.getProperty("window.minSessionLength", "5"));

            WindowExtractor extractor = new WindowExtractor(dbUrl, windowLength, stride, minLen);
            var allEvents = extractor.fetchAllEvents();

            if (allEvents.isEmpty()) {
                System.out.println("[ERROR] No events found in database. Please generate session data first.");
                return;
            }

            var windows = extractor.createWindows(allEvents);

            if (windows.isEmpty()) {
                System.out.printf("[WARNING] No windows created. Sessions may be shorter than window length (%d).%n",
                        windowLength);
                System.out.printf("[INFO] Total events: %d. Try lowering window.length in config.properties.%n",
                        allEvents.size());
                return;
            }

            // 4. Score windows
            RuleEngine engine = new RuleEngine(config);
            var scores = engine.scoreAll(windows);

            // 5. Export CSV
            String outputDir = config.getProperty("output.dir", "output");
            String filename = config.getProperty("output.filename", "rule_based_scores.csv");
            CsvExporter exporter = new CsvExporter(outputDir, filename);
            Path csvPath = exporter.export(scores);

            // 6. Summary
            CsvExporter.printSummary(scores);

            System.out.printf("%n[Done] CSV exported to: %s%n", csvPath.toAbsolutePath());
            System.out.println("[Next] Run: python evaluate.py --rule-csv " + csvPath);

        } catch (Exception e) {
            System.err.println("[ERROR] " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Load config.properties from classpath (src/main/resources/).
     */
    private static Properties loadConfig() throws IOException {
        Properties props = new Properties();
        try (InputStream is = RuleBasedScorer.class.getClassLoader()
                .getResourceAsStream("config.properties")) {
            if (is == null) {
                throw new FileNotFoundException("config.properties not found in classpath");
            }
            props.load(is);
        }
        return props;
    }

    /**
     * Load DATABASE_URL from ../.env (project root).
     * Fallback: environment variable DATABASE_URL.
     */
    private static String loadDatabaseUrl() {
        // Try .env in parent directory (project root)
        try {
            Dotenv dotenv = Dotenv.configure()
                    .directory("../")  // rule-based/ → project root
                    .ignoreIfMissing()
                    .load();
            String url = dotenv.get("DATABASE_URL");
            if (url != null && !url.isEmpty()) {
                return url;
            }
        } catch (Exception ignored) {}

        // Fallback: system environment variable
        String envUrl = System.getenv("DATABASE_URL");
        if (envUrl != null && !envUrl.isEmpty()) {
            return envUrl;
        }

        throw new RuntimeException(
            "DATABASE_URL not found. Set it in ../.env or as environment variable.");
    }
}
