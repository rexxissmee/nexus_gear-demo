import { NextRequest, NextResponse } from 'next/server'
import { evaluatePolicy, ruleBasedScore, DEFAULT_POLICY } from '@/lib/policy-engine'
import { EVENT_VOCAB } from '@/lib/event-logger'
import { spawn } from 'child_process'
import path from 'path'

// Force Node.js runtime (child_process + path not available on Edge)
export const runtime = 'nodejs'

/**
 * POST /api/security/score
 * Accepts a window of events and returns anomaly score + policy decision.
 *
 * Body: {
 *   events: Array<{event_type: string, delta_t_ms: number, flags: object}>
 *   use_rule_based?: boolean   // force rule-based scoring (bypass LSTM)
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const sessionId = request.headers.get('x-session-id')
            || request.cookies.get('session_id')?.value

        if (!sessionId) {
            return NextResponse.json({ error: 'No session' }, { status: 401 })
        }

        const body = await request.json()
        const { events = [], use_rule_based = false } = body

        // --- Rule-based flags summary ---
        const flagsSummary = {
            ip_change: events.some((e: Record<string, unknown>) => (e.flags as Record<string, number>)?.ip_change) ? 1 : 0,
            ua_change: events.some((e: Record<string, unknown>) => (e.flags as Record<string, number>)?.ua_change) ? 1 : 0,
            device_change: events.some((e: Record<string, unknown>) => (e.flags as Record<string, number>)?.device_change) ? 1 : 0,
            status_401: events.some((e: Record<string, unknown>) => e.event_type === 'STATUS_401') ? 1 : 0,
            status_403: events.some((e: Record<string, unknown>) => e.event_type === 'STATUS_403') ? 1 : 0,
            req_burst: events.some((e: Record<string, unknown>) => e.event_type === 'REQUEST_BURST') ? 1 : 0,
        }

        let inferResult: any = { risk_score: 0 }
        let scoringMethod: string

        if (use_rule_based || events.length === 0) {
            inferResult.risk_score = ruleBasedScore(flagsSummary)
            scoringMethod = 'rule_based'
        } else {
            try {
                inferResult = await callLSTMInfer(events)
                scoringMethod = 'lstm'
            } catch (err) {
                // Fallback to proxy if Python not available
                console.warn('[Score] LSTM infer failed, falling back to proxy:', err)
                inferResult.risk_score = computeProxyScore(events)
                scoringMethod = 'proxy_fallback'
            }
        }

        // Evaluate policy (EMA + consecutive windows)
        const policyResult = await evaluatePolicy(sessionId, inferResult.risk_score, DEFAULT_POLICY)

        return NextResponse.json({
            success: true,
            anomaly_score: policyResult.anomalyScore,
            risk_score: inferResult.risk_score,
            class_probs: inferResult.class_probs ?? null,
            predicted_label: inferResult.predicted_label ?? null,
            risk_ema: policyResult.riskEma,
            decision: policyResult.decision,
            reason: policyResult.reason ?? null,
            scoring_method: scoringMethod,
            top_events: getTopSurprising(events),
        })
    } catch (error) {
        console.error('POST /api/security/score error:', error)
        return NextResponse.json({ error: 'Scoring failed' }, { status: 500 })
    }
}

/**
 * Call ml/infer.py via child_process.
 * Sends event window as JSON on stdin, reads float score from stdout.
 * Timeout: 8 seconds (model loads fast on CPU for 30-event window).
 */
function callLSTMInfer(events: Array<{ event_type: string; delta_t_ms?: number }>): Promise<any> {
    return new Promise((resolve, reject) => {
        const mlDir = path.join(process.cwd(), 'ml')
        const inferPath = path.join(mlDir, 'infer.py')
        const venvPython = path.join(mlDir, '.venv', 'Scripts', 'python.exe')
        // Fallback to system python if venv not present
        const pythonBin = require('fs').existsSync(venvPython) ? venvPython : 'python'

        const payload = JSON.stringify({ events })

        const proc = spawn(pythonBin, [inferPath], {
            cwd: mlDir,
            timeout: 8000,
        })

        let stdout = ''
        let stderr = ''
        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

        proc.on('error', reject)
        proc.on('close', (code: number) => {
            if (code !== 0) {
                reject(new Error(`infer.py exited ${code}: ${stderr.slice(0, 200)}`))
                return
            }
            try {
                const outStruct = JSON.parse(stdout.trim())
                resolve(outStruct)
            } catch (err) {
                // fallback to bare float if script still returns number
                const score = parseFloat(stdout.trim());
                if (!isNaN(score)) {
                    resolve({ risk_score: score })
                } else {
                    reject(new Error(`infer.py returned invalid output: '${stdout.trim()}'`))
                }
            }
        })

        // Write payload to stdin
        proc.stdin.write(payload)
        proc.stdin.end()
    })
}

/**
 * Proxy anomaly score (fallback when LSTM unavailable).
 */
function computeProxyScore(events: Array<{ event_type: string; delta_t_ms?: number }>): number {
    const vocabSize = Object.keys(EVENT_VOCAB).length
    if (!events.length) return 0

    let total = 0
    const eventCounts = new Map<string, number>()
    events.forEach(e => {
        eventCounts.set(e.event_type, (eventCounts.get(e.event_type) ?? 0) + 1)
    })

    events.forEach((e, i) => {
        if (i === 0) return
        const count = eventCounts.get(e.event_type) ?? 1
        const prob = count / events.length
        const surpriseScore = -Math.log(Math.max(prob, 1 / vocabSize))
        const burstPenalty = (e.delta_t_ms ?? 1000) < 500 ? 0.5 : 0
        total += surpriseScore + burstPenalty
    })

    return total / Math.max(events.length - 1, 1)
}

function getTopSurprising(events: Array<{ event_type: string }>): string[] {
    const freq = new Map<string, number>()
    events.forEach(e => freq.set(e.event_type, (freq.get(e.event_type) ?? 0) + 1))
    return [...freq.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([type]) => type)
}
