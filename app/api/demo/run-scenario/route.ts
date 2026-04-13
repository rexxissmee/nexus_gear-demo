import { NextRequest, NextResponse } from 'next/server'
import { logEvent, type EventType } from '@/lib/event-logger'
import { evaluatePolicy, ruleBasedScore, DEFAULT_POLICY } from '@/lib/policy-engine'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

// Demo policy: fire on a single window (no consecutive requirement) so actions
// are always visible during a one-shot scenario run.
const DEMO_POLICY = {
    stepUpThreshold: 0.30,
    revokeThreshold: 0.55,
    emaAlpha: 0,          // EMA α=0 → EMA = raw score (no smoothing lag)
    stepUpConsecutive: 1,
    revokeConsecutive: 1,
}

// ─── Scenario definitions (based on real synthetic dataset patterns) ────────

type ScenarioEvent = {
    event_type: EventType
    delta_t_ms: number
    flags?: Record<string, number>
    metrics?: Record<string, number | string>
}

type Scenario = {
    id: string
    name: string
    description: string
    threat_level: 'low' | 'medium' | 'high' | 'critical'
    mitre_technique: string
    expected_model_behavior: {
        rule_based: string
        lstm: string
    }
    events: ScenarioEvent[]
}

// All 4 flags active (used in several scenarios)
const FULL_FLAGS = { ip_change: 1, ua_change: 1, device_change: 1, geo_change: 1 }
const IP_FLAGS = { ip_change: 1 }
const IP_UA_FLAGS = { ip_change: 1, ua_change: 1 }

const SCENARIOS: Record<string, Scenario> = {
    normal: {
        id: 'normal',
        name: 'Normal Browsing',
        description: 'User logs in and browses products normally. Periodic token rotation, no anomalous flags at any point.',
        threat_level: 'low',
        mitre_technique: 'Baseline — no attack technique',
        expected_model_behavior: {
            rule_based: 'Score ~0.00 — no abnormal flags. Decision: NONE.',
            lstm: 'Risk ~0.05 — familiar pattern, high confidence. Decision: NONE.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1693, flags: {}, metrics: { req_rate_10s: 1, endpoint_group: 'auth', status_group: '2xx' } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 238, flags: {}, metrics: { req_rate_10s: 1, endpoint_group: 'auth', status_group: '2xx' } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1804, flags: {}, metrics: { req_rate_10s: 1, endpoint_group: 'browse', status_group: '2xx' } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1373, flags: {}, metrics: { req_rate_10s: 1, endpoint_group: 'catalog' } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2124, flags: {}, metrics: { req_rate_10s: 1, endpoint_group: 'product' } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2635, flags: {}, metrics: { req_rate_10s: 2, endpoint_group: 'profile' } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 779, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2511, flags: {}, metrics: { req_rate_10s: 1, endpoint_group: 'browse' } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1157, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2855, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 3180, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 785, flags: {}, metrics: { req_rate_10s: 1 } },
        ],
    },

    vpn_masquerade: {
        id: 'vpn_masquerade',
        name: 'VPN Masquerade',
        description: 'Attacker hides their real IP behind a VPN. Session starts normally, then IP suddenly changes and sensitive APIs are accessed repeatedly.',
        threat_level: 'medium',
        mitre_technique: 'T1090 – Proxy / VPN Obfuscation',
        expected_model_behavior: {
            rule_based: 'Score ~0.15 (only ip_change averaged across window). May stay NONE.',
            lstm: 'Risk ~0.40 — LSTM detects the context shift: normal flow → ip_change + sensitive burst. Decision: STEP_UP.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1954, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 144, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1651, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2118, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 896, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2902, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 577, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1597, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2137, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 3378, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 1174, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← IP thay đổi (VPN connect)
            { event_type: 'FLAG_IP_CHANGE', delta_t_ms: 1656, flags: IP_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 802, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1106, flags: IP_FLAGS, metrics: { req_rate_10s: 3 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1547, flags: IP_FLAGS, metrics: { req_rate_10s: 4 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 795, flags: IP_FLAGS, metrics: { req_rate_10s: 5 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 674, flags: IP_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1019, flags: IP_FLAGS, metrics: { req_rate_10s: 7 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1213, flags: IP_FLAGS, metrics: { req_rate_10s: 8 } },
        ],
    },

    geo_anomaly: {
        id: 'geo_anomaly',
        name: 'Geo Anomaly Takeover',
        description: 'All 4 context attributes (IP, UA, device, geo) change simultaneously after an idle period — the clearest signal of a remote session takeover.',
        threat_level: 'critical',
        mitre_technique: 'T1563 – Remote Service Session Hijacking',
        expected_model_behavior: {
            rule_based: 'Score ~0.69 (ip+ua+device+geo+sensitive = 9.0/13). Decision: REVOKE.',
            lstm: 'Risk ~0.85 — all flags firing + rapid sensitive access = highest ATTACK probability. Decision: REVOKE.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 3265, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 313, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2921, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2634, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1928, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2190, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 1025, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1591, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1835, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2221, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 791, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← All 4 flags bật (geo change = session từ location khác hoàn toàn)
            { event_type: 'FLAG_GEO_CHANGE', delta_t_ms: 58416, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_DEVICE_CHANGE', delta_t_ms: 200, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 436, flags: FULL_FLAGS, metrics: { req_rate_10s: 4 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 389, flags: FULL_FLAGS, metrics: { req_rate_10s: 5 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 445, flags: FULL_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 465, flags: FULL_FLAGS, metrics: { req_rate_10s: 7 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 672, flags: FULL_FLAGS, metrics: { req_rate_10s: 8 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 807, flags: FULL_FLAGS, metrics: { req_rate_10s: 9 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 349, flags: FULL_FLAGS, metrics: { req_rate_10s: 10 } },
            { event_type: 'STEP_UP_REQUIRED', delta_t_ms: 392, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
        ],
    },

    brute_force: {
        id: 'brute_force',
        name: 'Brute Force Login',
        description: 'Credential stuffing from multiple rotating IPs. Each round: login attempt → STATUS_401 → REQUEST_BURST, alternating between IP-only and IP+Geo changes.',
        threat_level: 'high',
        mitre_technique: 'T1110.001 – Brute Force: Password Guessing',
        expected_model_behavior: {
            rule_based: 'Score ~0.62 (ip_change + status_401 + req_burst accumulate over repeated rounds). Decision: STEP_UP → REVOKE.',
            lstm: 'Risk ~0.78 — repeating AUTH_LOGIN→STATUS_401→REQUEST_BURST is a clear attack signature. Decision: REVOKE.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1332, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 178, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1887, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2730, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2719, flags: {}, metrics: { req_rate_10s: 2 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 901, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← Brute force begins
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 694, flags: IP_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'STATUS_401', delta_t_ms: 114, flags: IP_FLAGS, metrics: { req_rate_10s: 4 } },
            { event_type: 'REQUEST_BURST', delta_t_ms: 65, flags: IP_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 816, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 1 } },
            { event_type: 'STATUS_401', delta_t_ms: 142, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 5 } },
            { event_type: 'REQUEST_BURST', delta_t_ms: 110, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 7 } },
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 402, flags: IP_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'STATUS_401', delta_t_ms: 122, flags: IP_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'REQUEST_BURST', delta_t_ms: 142, flags: IP_FLAGS, metrics: { req_rate_10s: 8 } },
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 821, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 1 } },
            { event_type: 'STATUS_401', delta_t_ms: 142, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 7 } },
            { event_type: 'REQUEST_BURST', delta_t_ms: 96, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 9 } },
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 482, flags: IP_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'STATUS_401', delta_t_ms: 114, flags: IP_FLAGS, metrics: { req_rate_10s: 8 } },
            { event_type: 'REQUEST_BURST', delta_t_ms: 58, flags: IP_FLAGS, metrics: { req_rate_10s: 10 } },
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 628, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 1 } },
            { event_type: 'STATUS_401', delta_t_ms: 151, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 9 } },
            { event_type: 'REQUEST_BURST', delta_t_ms: 50, flags: { ip_change: 1, geo_change: 1 }, metrics: { req_rate_10s: 11 } },
        ],
    },

    session_hijacking: {
        id: 'session_hijacking',
        name: 'Session Hijacking',
        description: 'Attacker uses a stolen token from a different device. All 4 attributes (IP, UA, device, geo) change within a few hundred milliseconds — impossible for a real user switching devices.',
        threat_level: 'critical',
        mitre_technique: 'T1539 – Steal Web Session Cookie',
        expected_model_behavior: {
            rule_based: 'Score ~0.65 (all 4 flags + sensitive APIs). Decision: REVOKE.',
            lstm: 'Risk ~0.80 — 4 flag events within <1s is the strongest anomaly signature. Decision: REVOKE.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1874, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 137, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1512, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2194, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1351, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1565, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 783, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1786, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 3268, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2677, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 808, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← 4 flags bật gần đồng thời (dấu hiệu token bị đánh cắp)
            { event_type: 'FLAG_IP_CHANGE', delta_t_ms: 263, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_UA_CHANGE', delta_t_ms: 96, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_DEVICE_CHANGE', delta_t_ms: 117, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_GEO_CHANGE', delta_t_ms: 300, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 666, flags: FULL_FLAGS, metrics: { req_rate_10s: 4 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 574, flags: FULL_FLAGS, metrics: { req_rate_10s: 5 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 525, flags: FULL_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 625, flags: FULL_FLAGS, metrics: { req_rate_10s: 7 } },
            { event_type: 'STEP_UP_REQUIRED', delta_t_ms: 284, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
        ],
    },

    token_replay: {
        id: 'token_replay',
        name: 'Token Replay Attack',
        description: 'Attacker replays a valid JWT at extreme speed. Zero abnormal flags — only the pattern of TOKEN_REFRESH + API_CALL_SENSITIVE repeating every 50–110ms.',
        threat_level: 'high',
        mitre_technique: 'T1550.001 – Use Alternate Authentication Material: Application Access Token',
        expected_model_behavior: {
            rule_based: 'Score ~0.08 — BARELY DETECTED (no flags at all!). Decision: NONE.',
            lstm: 'Risk ~0.65 — LSTM detects velocity anomaly: sustained delta_t <100ms. Decision: STEP_UP.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 3157, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 424, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 4316, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1703, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2995, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 1079, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2660, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1590, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 8327, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 805, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← Token replay begins: rapid TOKEN_REFRESH + SENSITIVE loop
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 71, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 89, flags: {}, metrics: { req_rate_10s: 6 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 93, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 65, flags: {}, metrics: { req_rate_10s: 7 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 88, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 74, flags: {}, metrics: { req_rate_10s: 8 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 83, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 73, flags: {}, metrics: { req_rate_10s: 9 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 70, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 80, flags: {}, metrics: { req_rate_10s: 10 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 65, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 83, flags: {}, metrics: { req_rate_10s: 11 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 63, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 84, flags: {}, metrics: { req_rate_10s: 12 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 62, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 84, flags: {}, metrics: { req_rate_10s: 13 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 67, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 68, flags: {}, metrics: { req_rate_10s: 14 } },
            { event_type: 'TOKEN_REFRESH', delta_t_ms: 95, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 82, flags: {}, metrics: { req_rate_10s: 15 } },
        ],
    },

    cautious_pivot: {
        id: 'cautious_pivot',
        name: 'Cautious Pivot',
        description: 'Experienced attacker: long session idle (4+ min), then IP change but slow, deliberate access to avoid burst detection. Only 1 flag, low rate — designed to evade rule-based systems.',
        threat_level: 'medium',
        mitre_technique: 'T1078 – Valid Accounts (evasion variant)',
        expected_model_behavior: {
            rule_based: 'Score ~0.15 (only ip_change, slow rate does not trigger burst). Rule-based MISSES this. Decision: NONE.',
            lstm: 'Risk ~0.45 — LSTM detects: long idle → sudden ip_change → sensitive access = suspicious sequence. Decision: STEP_UP.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1526, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 291, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2038, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2184, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2146, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1274, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 1297, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 780, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2700, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1859, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← Long idle (4min+), then new IP – slow deliberate access
            { event_type: 'FLAG_IP_CHANGE', delta_t_ms: 262797, flags: IP_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 803, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2333, flags: IP_FLAGS, metrics: { req_rate_10s: 2 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2648, flags: IP_FLAGS, metrics: { req_rate_10s: 2 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2991, flags: IP_FLAGS, metrics: { req_rate_10s: 2 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 3801, flags: IP_FLAGS, metrics: { req_rate_10s: 2 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2606, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2043, flags: IP_FLAGS, metrics: { req_rate_10s: 2 } },
            { event_type: 'STEP_UP_REQUIRED', delta_t_ms: 1157, flags: IP_FLAGS, metrics: { req_rate_10s: 1 } },
        ],
    },

    step_up_failure: {
        id: 'step_up_failure',
        name: 'Step-Up Failure Chain',
        description: 'IP and UA change, triggering a step-up auth challenge. The attacker cannot pass MFA — STEP_UP_FAILED twice in a row. Clear indicator the attacker has a stolen token but not the MFA device.',
        threat_level: 'high',
        mitre_technique: 'T1621 – Multi-Factor Authentication Request Generation (bypass attempt)',
        expected_model_behavior: {
            rule_based: 'Score ~0.27 (ip+ua = 3.5/13). May trigger STEP_UP but not strong enough for REVOKE.',
            lstm: 'Risk ~0.70 — STEP_UP_FAILED×2 is a clear attacker signature (no MFA access). Decision: REVOKE.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1874, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 137, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1512, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2194, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2481, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1565, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 783, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1786, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 3268, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2677, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 808, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← IP+UA change (long idle then suspicious new context)
            { event_type: 'FLAG_IP_CHANGE', delta_t_ms: 341765, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_UA_CHANGE', delta_t_ms: 188, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 849, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 3 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 1201, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 5 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 855, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'STEP_UP_REQUIRED', delta_t_ms: 316, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'STEP_UP_FAILED', delta_t_ms: 9839, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'STEP_UP_FAILED', delta_t_ms: 27570, flags: IP_UA_FLAGS, metrics: { req_rate_10s: 1 } },
        ],
    },

    partial_exfil: {
        id: 'partial_exfil',
        name: 'Partial Exfiltration',
        description: 'Attacker waits for the session to go idle (5+ min), then takes full control with all 4 context changes, then rapidly calls sensitive APIs to exfiltrate data before detection.',
        threat_level: 'critical',
        mitre_technique: 'T1530 – Data from Cloud Storage Object (post-hijack exfiltration)',
        expected_model_behavior: {
            rule_based: 'Score ~0.65 (idle → full flags + rapid sensitive calls). Decision: REVOKE.',
            lstm: 'Risk ~0.75 — SESSION_IDLE_LONG + full context change + data exfil pattern. Decision: REVOKE.',
        },
        events: [
            { event_type: 'AUTH_LOGIN_SUCCESS', delta_t_ms: 1294, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ISSUE', delta_t_ms: 369, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 587, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1825, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2005, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 3190, flags: {}, metrics: { req_rate_10s: 3 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 1377, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1261, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1390, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 2666, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'TOKEN_ROTATE', delta_t_ms: 949, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← Session idle lâu
            { event_type: 'SESSION_IDLE_LONG', delta_t_ms: 306768, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 2360, flags: {}, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_NORMAL', delta_t_ms: 1302, flags: {}, metrics: { req_rate_10s: 1 } },
            // ← Full context hijack (attacker takes over idle session)
            { event_type: 'FLAG_IP_CHANGE', delta_t_ms: 317934, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_UA_CHANGE', delta_t_ms: 197, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_DEVICE_CHANGE', delta_t_ms: 123, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'FLAG_GEO_CHANGE', delta_t_ms: 135, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 589, flags: FULL_FLAGS, metrics: { req_rate_10s: 4 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 452, flags: FULL_FLAGS, metrics: { req_rate_10s: 5 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 732, flags: FULL_FLAGS, metrics: { req_rate_10s: 6 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 656, flags: FULL_FLAGS, metrics: { req_rate_10s: 7 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 861, flags: FULL_FLAGS, metrics: { req_rate_10s: 8 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 605, flags: FULL_FLAGS, metrics: { req_rate_10s: 9 } },
            { event_type: 'API_CALL_SENSITIVE', delta_t_ms: 512, flags: FULL_FLAGS, metrics: { req_rate_10s: 10 } },
            { event_type: 'STEP_UP_REQUIRED', delta_t_ms: 206, flags: FULL_FLAGS, metrics: { req_rate_10s: 1 } },
        ],
    },
}

// ─── LSTM inference (reuse logic from /api/security/score) ──────────────────

function callLSTM(events: ScenarioEvent[]): Promise<{
    risk_score: number
    predicted_label: string
    class_probs: { NORMAL: number; ATTACK: number }
}> {
    return new Promise((resolve, reject) => {
        const mlDir = path.join(process.cwd(), 'ml')
        const inferPath = path.join(mlDir, 'infer.py')
        const venvPython = path.join(mlDir, '.venv', 'Scripts', 'python.exe')
        const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python'

        const payload = JSON.stringify({
            events: events.map(e => ({
                event_type: e.event_type,
                delta_t_ms: e.delta_t_ms,
                flags: e.flags ?? {},
                metrics: e.metrics ?? {},
            })),
        })

        const proc = spawn(pythonBin, [inferPath], { cwd: mlDir, timeout: 10000 })
        let stdout = '', stderr = ''
        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
        proc.on('error', reject)
        proc.on('close', (code: number) => {
            if (code !== 0) { reject(new Error(`LSTM exited ${code}: ${stderr.slice(0, 200)}`)); return }
            try { resolve(JSON.parse(stdout.trim())) } catch { reject(new Error('LSTM bad output')) }
        })
        proc.stdin.write(payload)
        proc.stdin.end()
    })
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET() {
    // Return list of scenarios (metadata only)
    return NextResponse.json({
        scenarios: Object.values(SCENARIOS).map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            threat_level: s.threat_level,
            mitre_technique: s.mitre_technique,
            event_count: s.events.length,
            expected_model_behavior: s.expected_model_behavior,
        })),
    })
}

export async function POST(request: NextRequest) {
    try {
        const sessionId = request.headers.get('x-session-id')
            || request.cookies.get('session_id')?.value

        if (!sessionId) {
            return NextResponse.json({ error: 'No session' }, { status: 401 })
        }

        const body = await request.json()
        const { scenario_id, model } = body as { scenario_id: string; model: 'rule_based' | 'lstm' }

        const scenario = SCENARIOS[scenario_id]
        if (!scenario) {
            return NextResponse.json({ error: `Unknown scenario: ${scenario_id}` }, { status: 400 })
        }

        // 1. Log all events to DB
        let currentTs = Date.now() - scenario.events.reduce((acc, ev) => acc + ev.delta_t_ms, 0)
        const loggedEvents: Array<{ event_type: string; delta_t_ms: number; flags: Record<string, number> }> = []
        for (const ev of scenario.events) {
            currentTs += ev.delta_t_ms
            await logEvent(
                sessionId,
                ev.event_type as EventType,
                ev.flags ?? {},
                (ev.metrics ?? {}) as Record<string, string | number>,
                {},
                ev.delta_t_ms,
                new Date(currentTs)
            )
            loggedEvents.push({
                event_type: ev.event_type,
                delta_t_ms: ev.delta_t_ms,
                flags: ev.flags ?? {},
            })
        }

        // 2. Compute Rule-Based score
        const windowLen = scenario.events.length
        const countFlag = (key: string) =>
            scenario.events.reduce((n, e) => n + ((e.flags?.[key] ?? 0) > 0 ? 1 : 0), 0)
        const countType = (type: string) =>
            scenario.events.filter(e => e.event_type === type).length

        const flagsSummary = {
            ip_change: Math.min(countFlag('ip_change') / windowLen, 1),
            ua_change: Math.min(countFlag('ua_change') / windowLen, 1),
            device_change: Math.min(countFlag('device_change') / windowLen, 1),
            geo_change: Math.min(countFlag('geo_change') / windowLen, 1),
            status_401: Math.min(countType('STATUS_401') / windowLen, 1),
            status_403: Math.min(countType('STATUS_403') / windowLen, 1),
            req_burst: Math.min(countType('REQUEST_BURST') / windowLen, 1),
            api_sensitive: Math.min(countType('API_CALL_SENSITIVE') / windowLen, 1),
        }
        const ruleScore = ruleBasedScore(flagsSummary)

        // 3. Compute LSTM score (or fallback to rule)
        let lstmResult: { risk_score: number; predicted_label: string; class_probs: { NORMAL: number; ATTACK: number } } | null = null
        let lstmError: string | null = null
        try {
            lstmResult = await callLSTM(scenario.events)
        } catch (err) {
            lstmError = err instanceof Error ? err.message : String(err)
        }

        // 4. Evaluate policy with selected model
        const windowScore = model === 'lstm' && lstmResult
            ? lstmResult.risk_score
            : ruleScore
        // Use DEMO_POLICY (α=0, consecutive=1) so step-up/revoke always fire on
        // the very first window. Production would use DEFAULT_POLICY.
        const policyResult = await evaluatePolicy(sessionId, windowScore, DEMO_POLICY as typeof DEFAULT_POLICY, model)

        // 5. Rule-based breakdown
        const RULE_WEIGHTS = {
            ip_change: 2.0,
            ua_change: 1.5,
            device_change: 2.5,
            geo_change: 1.5,
            status_401: 1.0,
            status_403: 1.2,
            req_burst: 1.8,
            api_sensitive: 1.5,
        }
        const ruleBreakdown = Object.entries(flagsSummary).map(([key, val]) => ({
            feature: key,
            value: Math.round(val * 100) / 100,
            weight: RULE_WEIGHTS[key as keyof typeof RULE_WEIGHTS] ?? 0,
            contribution: Math.round(val * (RULE_WEIGHTS[key as keyof typeof RULE_WEIGHTS] ?? 0) * 100) / 100,
        }))

        return NextResponse.json({
            success: true,
            scenario: {
                id: scenario.id,
                name: scenario.name,
                threat_level: scenario.threat_level,
                mitre_technique: scenario.mitre_technique,
                expected_model_behavior: scenario.expected_model_behavior,
            },
            events_logged: loggedEvents,
            scoring: {
                model_used: model,
                rule_score: Math.round(ruleScore * 1000) / 1000,
                lstm_score: lstmResult ? Math.round(lstmResult.risk_score * 1000) / 1000 : null,
                lstm_predicted_label: lstmResult?.predicted_label ?? null,
                lstm_class_probs: lstmResult?.class_probs ?? null,
                lstm_error: lstmError,
                window_score: Math.round(windowScore * 1000) / 1000,
                risk_ema: Math.round(policyResult.riskEma * 1000) / 1000,
                decision: policyResult.decision,
                reason: policyResult.reason ?? null,
            },
            rule_breakdown: ruleBreakdown,
            rule_weights_info: {
                max_raw: 13.0,
                thresholds: { step_up: 0.30, revoke: 0.55 },
            },
        })
    } catch (error) {
        console.error('POST /api/demo/run-scenario error:', error)
        return NextResponse.json({ error: 'Scenario execution failed' }, { status: 500 })
    }
}
