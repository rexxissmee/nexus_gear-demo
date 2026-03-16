import { prisma } from '@/lib/prisma'
import { logAuditAction, logEvent } from '@/lib/event-logger'
import { revokeSession } from '@/lib/session'

// ==================== POLICY ENGINE CONFIG ====================
export interface PolicyConfig {
    warnThreshold: number       // 0.50
    stepUpThreshold: number     // 0.70
    revokeThreshold: number     // 0.90
    emaAlpha: number            // β: EMA smoothing (e.g. 0.3)
    warnConsecutive: number     // consecutive windows to trigger WARN
    stepUpConsecutive: number   // consecutive windows to trigger STEP_UP
    revokeConsecutive: number   // consecutive windows to trigger REVOKE
}

export const DEFAULT_POLICY: PolicyConfig = {
    warnThreshold: 0.50,
    stepUpThreshold: 0.70,
    revokeThreshold: 0.90,
    emaAlpha: 0.3,
    warnConsecutive: 1,
    stepUpConsecutive: 2,
    revokeConsecutive: 3,
}

// In-memory EMA and consecutive states (per session)
// In production this would be in Redis
const emaCache = new Map<string, number>()

interface SessionViolationState {
    warnCount: number;
    stepUpCount: number;
    revokeCount: number;
}
const consecutiveCache = new Map<string, SessionViolationState>()

export type PolicyDecision = 'NONE' | 'WARN' | 'STEP_UP' | 'REVOKE'

export interface PolicyResult {
    decision: PolicyDecision
    anomalyScore: number
    riskEma: number
    reason?: string
}

/**
 * Evaluate a window sequence probability score through the policy engine.
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

    const state = consecutiveCache.get(sessionId) ?? { warnCount: 0, stepUpCount: 0, revokeCount: 0 }

    if (riskEma >= config.revokeThreshold) {
        state.revokeCount++
        state.stepUpCount++
        state.warnCount++
    } else if (riskEma >= config.stepUpThreshold) {
        state.revokeCount = 0
        state.stepUpCount++
        state.warnCount++
    } else if (riskEma >= config.warnThreshold) {
        state.revokeCount = 0
        state.stepUpCount = 0
        state.warnCount++
    } else {
        state.revokeCount = 0
        state.stepUpCount = 0
        state.warnCount = 0
    }
    
    consecutiveCache.set(sessionId, state)

    let decision: PolicyDecision = 'NONE'
    let reason: string | undefined

    if (state.revokeCount >= config.revokeConsecutive) {
        decision = 'REVOKE'
        reason = `Risk EMA ${riskEma.toFixed(3)} >= ${config.revokeThreshold} for ${state.revokeCount} consecutive windows`
        consecutiveCache.delete(sessionId)
        emaCache.delete(sessionId)
        // Auto-revoke
        await revokeSession(sessionId, reason)
    } else if (state.stepUpCount >= config.stepUpConsecutive) {
        decision = 'STEP_UP'
        reason = `Risk EMA ${riskEma.toFixed(3)} >= ${config.stepUpThreshold} for ${state.stepUpCount} consecutive windows`
    } else if (state.warnCount >= config.warnConsecutive) {
        decision = 'WARN'
        reason = `Risk EMA ${riskEma.toFixed(3)} >= ${config.warnThreshold} for ${state.warnCount} consecutive windows`
    }

    // Log audit if action needed
    if (decision !== 'NONE') {
        await logAuditAction(sessionId, decision, reason, windowScore, riskEma)
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
