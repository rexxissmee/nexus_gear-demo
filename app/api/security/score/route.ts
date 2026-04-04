import { NextRequest, NextResponse } from 'next/server'
import { evaluatePolicy, ruleBasedScore, DEFAULT_POLICY } from '@/lib/policy-engine'
import { EVENT_VOCAB } from '@/lib/event-logger'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// Force Node.js runtime (child_process + path not available on Edge)
export const runtime = 'nodejs'

/** Read scoring mode from security_config.json written by /api/security/scoring-mode */
function getGlobalScoringMode(): 'lstm' | 'rule_based' {
    try {
        const configPath = path.join(process.cwd(), 'security_config.json')
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            if (cfg.scoringMode === 'rule_based') return 'rule_based'
        }
    } catch { /* default to lstm */ }
    return 'lstm'
}

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

        // Rule-based flags summary — count occurrences across window, not just presence
        // This prevents a single flag event from trivially crossing the threshold
        const windowLen = events.length || 1
        const countFlag = (key: string) =>
            events.reduce((n: number, e: Record<string, unknown>) =>
                n + (((e.flags as Record<string, number>)?.[key] ?? 0) > 0 ? 1 : 0), 0)
        const countType = (type: string) =>
            events.filter((e: Record<string, unknown>) => e.event_type === type).length

        const flagsSummary = {
            ip_change:     Math.min(countFlag('ip_change')     / windowLen, 1),
            ua_change:     Math.min(countFlag('ua_change')     / windowLen, 1),
            device_change: Math.min(countFlag('device_change') / windowLen, 1),
            status_401:    Math.min(countType('STATUS_401')    / windowLen, 1),
            status_403:    Math.min(countType('STATUS_403')    / windowLen, 1),
            req_burst:     Math.min(countType('REQUEST_BURST') / windowLen, 1),
        }

        // Determine scoring method: global config > request body override
        const globalMode = getGlobalScoringMode()
        const forceRuleBased = use_rule_based || globalMode === 'rule_based'

        let inferResult: any = { risk_score: 0 }
        let scoringMethod: string

        if (forceRuleBased || events.length === 0) {
            inferResult.risk_score = ruleBasedScore(flagsSummary)
            scoringMethod = events.length === 0 ? 'rule_based_empty' : 'rule_based'
        } else {
            try {
                inferResult = await callLSTMInfer(events)
                scoringMethod = 'lstm'
            } catch (err) {
                // Fallback to ruleBasedScore if Python not available
                console.warn('[Score] LSTM infer failed, falling back to ruleBasedScore:', err)
                inferResult.risk_score = ruleBasedScore(flagsSummary)
                scoringMethod = 'rule_based_fallback'
            }
        }

        // Evaluate policy — pass mode so correct thresholds are applied
        const policyResult = await evaluatePolicy(sessionId, inferResult.risk_score, DEFAULT_POLICY, globalMode)

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


function getTopSurprising(events: Array<{ event_type: string }>): string[] {
    const freq = new Map<string, number>()
    events.forEach(e => freq.set(e.event_type, (freq.get(e.event_type) ?? 0) + 1))
    return [...freq.entries()]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([type]) => type)
}
