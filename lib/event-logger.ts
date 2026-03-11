import { prisma } from '@/lib/prisma'

// ==================== EVENT VOCABULARY ====================
export const EVENT_VOCAB: Record<string, number> = {
    AUTH_LOGIN_SUCCESS: 0,
    AUTH_LOGOUT: 1,
    TOKEN_ISSUE: 2,
    TOKEN_REFRESH: 3,
    TOKEN_ROTATE: 4,
    TOKEN_REVOKE: 5,
    API_CALL_NORMAL: 6,
    API_CALL_SENSITIVE: 7,
    FLAG_IP_CHANGE: 8,
    FLAG_UA_CHANGE: 9,
    FLAG_DEVICE_CHANGE: 10,
    FLAG_GEO_CHANGE: 11,
    STATUS_401: 12,
    STATUS_403: 13,
    SESSION_IDLE_LONG: 14,
    REQUEST_BURST: 15,
    STEP_UP_REQUIRED: 16,
    STEP_UP_PASSED: 17,
    SESSION_ANOMALY_WARN: 18,
} as const

export type EventType = keyof typeof EVENT_VOCAB

export interface EventFlags {
    ip_change?: number       // 0 or 1 (flag only, not the actual IP)
    ua_change?: number       // 0 or 1
    device_change?: number   // 0 or 1
    geo_change?: number      // 0 or 1
    cookie_missing?: number  // 0 or 1
}

export interface EventMetrics {
    req_rate_10s?: number
    endpoint_group?: string
    status_group?: string
}

export interface EventConfig {
    rotation_enabled?: boolean
    passkey_enabled?: boolean
    method?: string
}

// Track last event per session for delta_t calculation
const lastEventTime = new Map<string, number>()

/**
 * Log a session event to the database (non-PII).
 * Automatically computes delta_t_ms from the previous event in the same session.
 */
export async function logEvent(
    sessionId: string,
    eventType: EventType,
    flags: EventFlags = {},
    metrics: EventMetrics = {},
    config: EventConfig = {}
): Promise<void> {
    const now = Date.now()
    const last = lastEventTime.get(sessionId) ?? now
    const deltaT_ms = now - last
    lastEventTime.set(sessionId, now)

    const eventTypeId = EVENT_VOCAB[eventType] ?? -1

    try {
        await prisma.sessionEvent.create({
            data: {
                sessionId,
                eventType,
                eventTypeId,
                deltaT_ms,
                flags: flags as object,
                metrics: metrics as object,
                config: config as object,
                ts: new Date(now),
            },
        })
    } catch (err) {
        // Non-fatal: log error but don't break the request
        console.error('[EventLogger] Failed to log event:', eventType, err)
    }
}

/**
 * Log a policy action to the audit log.
 */
export async function logAuditAction(
    sessionId: string,
    action: 'WARN' | 'STEP_UP' | 'REVOKE' | 'TOKEN_ROTATE',
    reason?: string,
    anomalyScore?: number,
    riskEma?: number
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                sessionId,
                action,
                reason,
                anomalyScore,
                riskEma,
            },
        })
    } catch (err) {
        console.error('[EventLogger] Failed to log audit action:', action, err)
    }
}
