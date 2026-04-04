import { prisma } from '@/lib/prisma'
import { logAuditAction, logEvent } from '@/lib/event-logger'
import { revokeSession } from '@/lib/session'

import fs from 'fs'
import path from 'path'

// ==================== POLICY ENGINE CONFIG ====================
export interface PolicyConfig {
    stepUpThreshold: number     // 0.45 (from ML)
    revokeThreshold: number     // 0.75 (from ML)
    emaAlpha: number            // β: EMA smoothing (e.g. 0.3)
    stepUpConsecutive: number   // consecutive windows to trigger STEP_UP
    revokeConsecutive: number   // consecutive windows to trigger REVOKE
}

export const DEFAULT_POLICY: PolicyConfig = {
    stepUpThreshold: 0.45,
    revokeThreshold: 0.75,
    emaAlpha: 0.3,
    stepUpConsecutive: 2,
    revokeConsecutive: 3,
}

// Lấy threshold theo mode đang active
export function getModelThresholds(mode: 'lstm' | 'rule_based' = 'lstm') {
    if (mode === 'rule_based') {
        // Rule-Based score đã được normalize [0,1] (/ MAX_RULE 11.5).
        // Ngưỡng từ evaluate.py threshold_sweep_rule.json:
        //   step_up=0.30 → precision=0.85, recall=0.53
        //   revoke =0.55 → precision cao hơn, conservative
        return { stepUp: 0.30, revoke: 0.55 }
    }
    // LSTM: đọc file calibrated từ train pipeline (step_up=0.3, revoke=0.5)
    try {
        const tPath = path.join(process.cwd(), 'ml/artifacts/models/thresholds.json')
        if (fs.existsSync(tPath)) {
            const data = JSON.parse(fs.readFileSync(tPath, 'utf-8'))
            return {
                stepUp: data.step_up ?? 0.45,
                revoke: data.revoke ?? 0.75
            }
        }
    } catch (e) { }
    return { stepUp: 0.45, revoke: 0.75 }
}

// In-memory EMA and consecutive states (per session)
// In production this would be in Redis
const emaCache = new Map<string, number>()

interface SessionViolationState {
    stepUpCount: number;
    revokeCount: number;
}
const consecutiveCache = new Map<string, SessionViolationState>()

export type PolicyDecision = 'NONE' | 'STEP_UP' | 'REVOKE'

export interface PolicyResult {
    decision: PolicyDecision
    anomalyScore: number
    riskEma: number
    reason?: string
}

/**
 * Evaluate a window sequence probability score through the policy engine.
 * Updates EMA state and applies consecutive-window thresholding.
 * @param scoringMode - 'lstm' uses calibrated ML thresholds; 'rule_based' uses separate thresholds
 */
export async function evaluatePolicy(
    sessionId: string,
    windowScore: number,
    config: PolicyConfig = DEFAULT_POLICY,
    scoringMode: 'lstm' | 'rule_based' = 'lstm'
): Promise<PolicyResult> {
    const thr = getModelThresholds(scoringMode)
    const activeConfig = {
        ...config,
        stepUpThreshold: thr.stepUp,
        revokeThreshold: thr.revoke
    }

    // EMA smoothing: R_t = β * R_{t-1} + (1 - β) * S_window
    const prevEma = emaCache.get(sessionId) ?? windowScore
    const riskEma = activeConfig.emaAlpha * prevEma + (1 - activeConfig.emaAlpha) * windowScore
    emaCache.set(sessionId, riskEma)

    const state = consecutiveCache.get(sessionId) ?? { stepUpCount: 0, revokeCount: 0 }

    if (riskEma >= activeConfig.revokeThreshold) {
        state.revokeCount++
        state.stepUpCount++
    } else if (riskEma >= activeConfig.stepUpThreshold) {
        state.revokeCount = 0
        state.stepUpCount++
    } else {
        state.revokeCount = 0
        state.stepUpCount = 0
    }

    consecutiveCache.set(sessionId, state)

    let decision: PolicyDecision = 'NONE'
    let reason: string | undefined

    if (state.revokeCount >= activeConfig.revokeConsecutive) {
        decision = 'REVOKE'
        reason = `Risk EMA ${riskEma.toFixed(3)} >= ${activeConfig.revokeThreshold} for ${state.revokeCount} consecutive windows`
        consecutiveCache.delete(sessionId)
        emaCache.delete(sessionId)
        // Auto-revoke
        await revokeSession(sessionId, reason)
    } else if (state.stepUpCount >= activeConfig.stepUpConsecutive) {
        decision = 'STEP_UP'
        reason = `Risk EMA ${riskEma.toFixed(3)} >= ${activeConfig.stepUpThreshold} for ${state.stepUpCount} consecutive windows`
    }

    // Log audit if action needed
    if (decision !== 'NONE') {
        await logAuditAction(sessionId, decision, reason, windowScore, riskEma)
    }

    return { decision, anomalyScore: windowScore, riskEma, reason }
}

/**
 * Simple rule-based anomaly score (baseline to compare against LSTM).
 * Returns a normalized score [0, 1] — consistent with evaluate.py (MAX_RULE = 13.0).
 */
const RULE_MAX_SCORE = 13.0

export function ruleBasedScore(flags: {
    ip_change?: number
    ua_change?: number
    device_change?: number
    geo_change?: number
    status_401?: number
    status_403?: number
    req_burst?: number
    api_sensitive?: number
}): number {
    let raw = 0
    if (flags.ip_change) raw += 2.0
    if (flags.ua_change) raw += 1.5
    if (flags.device_change) raw += 2.5
    if (flags.geo_change) raw += 1.5
    if (flags.status_401) raw += 1.0
    if (flags.status_403) raw += 1.2
    if (flags.req_burst) raw += 1.8
    if (flags.api_sensitive) raw += 1.5
    return Math.min(raw / RULE_MAX_SCORE, 1.0)
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
    const synthDate = new Date('2026-02-02T00:00:00.000Z')
    const [totalSessions, revokedSessions, auditActions, recentEvents] = await Promise.all([
        prisma.session.count({ where: { createdAt: { gt: synthDate } } }),
        prisma.session.count({ where: { revokedAt: { not: null }, createdAt: { gt: synthDate } } }),
        prisma.auditLog.groupBy({ by: ['action'], _count: true, where: { ts: { gt: synthDate } } }),
        prisma.sessionEvent.findMany({
            where: { ts: { gt: synthDate } },
            orderBy: { ts: 'desc' },
            take: 100,
            select: { sessionId: true, eventType: true, deltaT_ms: true, ts: true },
        }),
    ])

    const auditCounts = auditActions.reduce((acc, a) => {
        acc[a.action] = a._count
        return acc
    }, {} as Record<string, number>)

    const stepUps = auditCounts['STEP_UP'] ?? 0
    const revokes = auditCounts['REVOKE'] ?? 0

    return {
        totalSessions,
        activeSessions: totalSessions - revokedSessions,
        revokedSessions,
        stepUps,
        revokes,
        recentEvents,
    }
}
