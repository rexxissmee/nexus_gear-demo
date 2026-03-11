import { prisma } from '@/lib/prisma'
import { logAuditAction, logEvent } from '@/lib/event-logger'
import { revokeSession } from '@/lib/session'

// ==================== POLICY ENGINE CONFIG ====================
export interface PolicyConfig {
    warnThreshold: number       // T_warn = P99(R) – set after calibration
    blockThreshold: number      // T_block = P99.9(R)
    emaAlpha: number            // β: EMA smoothing (e.g. 0.3)
    warnConsecutive: number     // consecutive windows to trigger WARN (default 2)
    revokeConsecutive: number   // consecutive windows to trigger REVOKE (default 3)
}

export const DEFAULT_POLICY: PolicyConfig = {
    warnThreshold: 0.4824,      // T_warn = P99(normal) – calibrated from LSTM (2026-02-27)
    blockThreshold: 0.5295,     // T_block = P99.9(normal) – calibrated from LSTM (2026-02-27)
    emaAlpha: 0.3,
    warnConsecutive: 2,
    revokeConsecutive: 3,
}

// In-memory EMA state (per session)
// In production this would be in Redis
const emaCache = new Map<string, number>()
const consecutiveCache = new Map<string, number>()

export type PolicyDecision = 'NONE' | 'WARN' | 'STEP_UP' | 'REVOKE'

export interface PolicyResult {
    decision: PolicyDecision
    anomalyScore: number
    riskEma: number
    reason?: string
}

/**
 * Evaluate a window anomaly score through the policy engine.
 * Updates EMA state and applies consecutive-window thresholding.
 */
export async function evaluatePolicy(
    sessionId: string,
    windowScore: number,
    config: PolicyConfig = DEFAULT_POLICY
): Promise<PolicyResult> {
    // EMA smoothing: R_t = β * R_{t-1} + (1 - β) * S_window
    const prevEma = emaCache.get(sessionId) ?? windowScore
    const riskEma = config.emaAlpha * prevEma + (1 - config.emaAlpha) * windowScore
    emaCache.set(sessionId, riskEma)

    let decision: PolicyDecision = 'NONE'
    let reason: string | undefined

    if (riskEma > config.blockThreshold) {
        const count = (consecutiveCache.get(sessionId) ?? 0) + 1
        consecutiveCache.set(sessionId, count)

        if (count >= config.revokeConsecutive) {
            decision = 'REVOKE'
            reason = `Risk EMA ${riskEma.toFixed(3)} > block threshold ${config.blockThreshold} for ${count} consecutive windows`
            consecutiveCache.delete(sessionId)
            emaCache.delete(sessionId)
            // Auto-revoke
            await revokeSession(sessionId, reason)
        } else {
            decision = 'STEP_UP'
            reason = `Risk EMA ${riskEma.toFixed(3)} > block threshold, consecutive=${count}`
        }
    } else if (riskEma > config.warnThreshold) {
        const count = (consecutiveCache.get(sessionId) ?? 0) + 1
        consecutiveCache.set(sessionId, count)

        if (count >= config.warnConsecutive) {
            decision = count >= config.revokeConsecutive ? 'STEP_UP' : 'WARN'
            reason = `Risk EMA ${riskEma.toFixed(3)} > warn threshold for ${count} consecutive windows`
        }
    } else {
        // Below threshold: reset consecutive counter
        consecutiveCache.set(sessionId, 0)
    }

    // Log audit if action needed
    if (decision !== 'NONE') {
        await logAuditAction(sessionId, decision === 'STEP_UP' ? 'STEP_UP' :
            decision === 'REVOKE' ? 'REVOKE' : 'WARN',
            reason, windowScore, riskEma
        )
        if (decision === 'WARN') {
            await logEvent(sessionId, 'SESSION_ANOMALY_WARN', {}, { req_rate_10s: 0 }, {})
        }
    }

    return { decision, anomalyScore: windowScore, riskEma, reason }
}

/**
 * Simple rule-based anomaly score (baseline to compare against LSTM).
 * Returns a score [0, ∞) based on flag patterns.
 */
export function ruleBasedScore(flags: {
    ip_change?: number
    ua_change?: number
    device_change?: number
    status_401?: number
    status_403?: number
    req_burst?: number
}): number {
    let score = 0
    if (flags.ip_change) score += 2.0
    if (flags.ua_change) score += 1.5
    if (flags.device_change) score += 2.5
    if (flags.status_401) score += 1.0
    if (flags.status_403) score += 1.2
    if (flags.req_burst) score += 1.8
    return score
}

/**
 * Get recent audit log for a session
 */
export async function getSessionAuditLog(sessionId: string) {
    return prisma.auditLog.findMany({
        where: { sessionId },
        orderBy: { ts: 'desc' },
        take: 50,
    })
}

/**
 * Get dashboard stats
 */
export async function getSecurityDashboardStats() {
    const [totalSessions, revokedSessions, auditActions, recentEvents] = await Promise.all([
        prisma.session.count(),
        prisma.session.count({ where: { revokedAt: { not: null } } }),
        prisma.auditLog.groupBy({ by: ['action'], _count: true }),
        prisma.sessionEvent.findMany({
            orderBy: { ts: 'desc' },
            take: 100,
            select: { sessionId: true, eventType: true, deltaT_ms: true, ts: true },
        }),
    ])

    const auditCounts = auditActions.reduce((acc, a) => {
        acc[a.action] = a._count
        return acc
    }, {} as Record<string, number>)

    const warns       = auditCounts['WARN']    ?? 0
    const stepUps     = auditCounts['STEP_UP'] ?? 0
    const revokes     = auditCounts['REVOKE']  ?? 0
    // FPR estimate = warns on non-policy-revoked sessions / total such sessions
    const normalSessions = totalSessions - revokedSessions
    const estimatedFpr   = normalSessions > 0 ? warns / normalSessions : 0

    return {
        totalSessions,
        activeSessions: totalSessions - revokedSessions,
        revokedSessions,
        warns,
        stepUps,
        revokes,
        estimatedFpr: parseFloat(estimatedFpr.toFixed(4)),
        recentEvents,
    }
}
