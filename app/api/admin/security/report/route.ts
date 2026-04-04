import { NextRequest, NextResponse } from 'next/server'
import { getSecurityDashboardStats, ruleBasedScore, DEFAULT_POLICY } from '@/lib/policy-engine'

import fs from 'fs'
import path from 'path'

// Force Node.js runtime (uses fs + path, not available on Edge)
export const runtime = 'nodejs'

const ML_DIR = path.join(process.cwd(), 'ml', 'artifacts')

function readJson<T>(filePath: string): T | null {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
        }
    } catch (e) {
        console.warn('[Report] Failed to read', filePath, e)
    }
    return null
}

/**
 * GET /api/admin/security/report
 * Returns dashboard stats + ML metrics + risk score distribution + rule-based comparison.
 * Accepts ?format=csv for a plain-text export.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const format = searchParams.get('format') ?? 'json'

        const stats = await getSecurityDashboardStats()

        if (format === 'csv') {
            const mlMetrics = readJson<Record<string, number>>(
                path.join(ML_DIR, 'reports', 'metrics_test.json')
            )
            const csvRows = [
                'metric,value',
                `total_sessions,${stats.totalSessions}`,
                `active_sessions,${stats.activeSessions}`,
                `revoked_sessions,${stats.revokedSessions}`,
                `step_ups,${stats.stepUps}`,
                `revokes,${stats.revokes}`,
                ...(mlMetrics ? [
                    `roc_auc,${mlMetrics.roc_auc}`,
                    `f1_score,${mlMetrics.f1_score}`,
                    `precision,${mlMetrics.precision}`,
                    `recall,${mlMetrics.recall}`,
                    `fpr,${mlMetrics.fpr}`,
                    `tn,${mlMetrics.tn}`,
                    `fp,${mlMetrics.fp}`,
                    `fn,${mlMetrics.fn}`,
                    `tp,${mlMetrics.tp}`,
                ] : []),
            ]
            return new NextResponse(csvRows.join('\n'), {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="security_report_${Date.now()}.csv"`,
                },
            })
        }

        // ── ML metrics (from evaluate.py output) ──────────────────────────
        const mlMetrics = readJson<Record<string, number>>(path.join(ML_DIR, 'reports', 'metrics_test.json'))

        // ── ML Comparison LSTM vs Rule-Based ─────────────────────────────
        const mlComparison = readJson<{
            lstm: Record<string, number | string>
            rule_based: Record<string, number | string> | null
            delta: Record<string, number>
        }>(path.join(ML_DIR, 'reports', 'comparison_lstm_vs_rule.json'))

        // ── Risk score distribution from predictions.csv ──────────────────
        let riskScoreDistribution: number[] | null = null
        try {
            const predPath = path.join(ML_DIR, 'reports', 'predictions.csv')
            if (fs.existsSync(predPath)) {
                const lines = fs.readFileSync(predPath, 'utf8').trim().split('\n').slice(1) // skip header
                const scores = lines.map(l => parseFloat(l.split(',')[1])).filter(n => !isNaN(n))

                // Build 20-bucket histogram [0, 0.05, 0.10 ... 1.0]
                const BUCKETS = 20
                const hist = new Array<number>(BUCKETS).fill(0)
                scores.forEach(s => {
                    const idx = Math.min(Math.floor(s * BUCKETS), BUCKETS - 1)
                    hist[idx]++
                })
                riskScoreDistribution = hist
            }
        } catch (e) {
            console.warn('[Report] Failed to build risk score histogram', e)
        }

        // ── Rule-based comparison ─────────────────────────────────────────
        // Replay the recent events through the rule-based scorer to get a side-by-side
        let ruleBasedStats: Record<string, number> | null = null
        try {
            const recentEvents = stats.recentEvents as Array<{
                eventType: string
                deltaT_ms: number
            }>
            if (recentEvents.length > 0) {
                // Build flag summary over recent 30 events for comparison
                const window = recentEvents.slice(0, 30)
                const flags = {
                    ip_change:     window.some(e => e.eventType === 'FLAG_IP_CHANGE') ? 1 : 0,
                    ua_change:     window.some(e => e.eventType === 'FLAG_UA_CHANGE') ? 1 : 0,
                    device_change: window.some(e => e.eventType === 'FLAG_DEVICE_CHANGE') ? 1 : 0,
                    status_401:    window.some(e => e.eventType === 'STATUS_401') ? 1 : 0,
                    status_403:    window.some(e => e.eventType === 'STATUS_403') ? 1 : 0,
                    req_burst:     window.some(e => e.eventType === 'REQUEST_BURST') ? 1 : 0,
                }
                ruleBasedStats = {
                    score: ruleBasedScore(flags),
                    ...flags,
                }
            }
        } catch (e) {
            console.warn('[Report] Failed to compute rule-based stats', e)
        }

        // ── Active thresholds (per scoring mode) ─────────────────────────────
        // Read current mode so the dashboard shows the correct step_up/revoke values
        let currentMode: 'lstm' | 'rule_based' = 'lstm'
        try {
            const cfgPath = path.join(process.cwd(), 'security_config.json')
            if (fs.existsSync(cfgPath)) {
                const sc = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
                if (sc.scoringMode === 'rule_based') currentMode = 'rule_based'
            }
        } catch { /* default lstm */ }

        let thresholds: { stepUp: number; revoke: number; source: string } =
            currentMode === 'rule_based'
                ? { stepUp: 0.30, revoke: 0.55, source: 'rule_based_fixed' }
                : { stepUp: DEFAULT_POLICY.stepUpThreshold, revoke: DEFAULT_POLICY.revokeThreshold, source: 'default' }

        if (currentMode === 'lstm') {
            try {
                const calibrated = readJson<{ step_up: number; revoke: number; calibrated: boolean }>(
                    path.join(process.cwd(), 'ml', 'artifacts', 'models', 'thresholds.json')
                )
                if (calibrated?.calibrated) {
                    thresholds = {
                        stepUp: calibrated.step_up,
                        revoke: calibrated.revoke,
                        source: 'calibrated',
                    }
                }
            } catch { /* Keep default */ }
        }

        return NextResponse.json({
            success: true,
            ...stats,
            mlMetrics,
            mlComparison,
            riskScoreDistribution,
            ruleBasedStats,
            thresholds,
        })
    } catch (error) {
        console.error('GET /api/admin/security/report error:', error)
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
    }
}
