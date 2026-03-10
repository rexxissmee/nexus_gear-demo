'use client'
/**
 * useSecurityMonitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side security hook that:
 *  1. Buffers user events (page navigations, fetch calls) into a sliding window
 *  2. Detects: idle timeout → SESSION_IDLE_LONG, request burst → REQUEST_BURST
 *  3. Periodically scores the current window via POST /api/security/score
 *  4. Returns policy decision so the caller can react (WARN toast / STEP_UP dialog / REVOKE)
 *
 * Usage: call this hook inside a "use client" component mounted at root level.
 */

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ── Config ────────────────────────────────────────────────────────────────────
const SCORE_INTERVAL_MS = 10_000  // score window every 10s (set to 60_000 for production)
const IDLE_TIMEOUT_MS = 5 * 60_000  // 5 min idle → SESSION_IDLE_LONG
const BURST_WINDOW_MS = 3_000  // look-back window for burst detection
const BURST_THRESHOLD = 5      // ≥5 fetches in BURST_WINDOW_MS → REQUEST_BURST
const MAX_WINDOW_EVENTS = 30     // sliding window size (same as LSTM window_length)

// ── Types ─────────────────────────────────────────────────────────────────────
export type SecurityEvent = {
    event_type: string
    delta_t_ms: number
    flags: Record<string, number>
    ts: number  // epoch ms, not sent to server
}

export type PolicyDecision = 'NONE' | 'WARN' | 'STEP_UP' | 'REVOKE'

export interface ScoreResult {
    decision: PolicyDecision
    anomaly_score: number
    risk_ema: number
    reason?: string
}

// ── Main Hook ─────────────────────────────────────────────────────────────────
export function useSecurityMonitor(opts: {
    enabled: boolean
    onDecision?: (result: ScoreResult) => void
}) {
    const { enabled, onDecision } = opts
    const pathname = usePathname()

    // Buffers
    const windowRef = useRef<SecurityEvent[]>([])
    const fetchTimesRef = useRef<number[]>([])

    // Timers
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Last event ts for delta_t calculation
    const lastTsRef = useRef<number>(Date.now())

    // ── Add event to sliding window ────────────────────────────────────────────
    const pushEvent = useCallback((type: string, flags: Record<string, number> = {}) => {
        const now = Date.now()
        const delta_t_ms = now - lastTsRef.current
        lastTsRef.current = now

        const ev: SecurityEvent = { event_type: type, delta_t_ms, flags, ts: now }
        windowRef.current = [...windowRef.current.slice(-(MAX_WINDOW_EVENTS - 1)), ev]
    }, [])

    // ── Reset idle timer ───────────────────────────────────────────────────────
    const resetIdle = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
            pushEvent('SESSION_IDLE_LONG')
        }, IDLE_TIMEOUT_MS)
    }, [pushEvent])

    // ── Score current window ───────────────────────────────────────────────────
    const scoreWindow = useCallback(async () => {
        const events = windowRef.current
        if (!events.length) return

        try {
            const res = await fetch('/api/security/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    events: events.map(e => ({
                        event_type: e.event_type,
                        delta_t_ms: e.delta_t_ms,
                        flags: e.flags,
                    })),
                }),
                cache: 'no-store',
            })

            if (res.ok) {
                const data: ScoreResult = await res.json()
                if (data.decision !== 'NONE') {
                    onDecision?.(data)
                }
            }
        } catch {
            // Network errors are silent – don't disrupt user
        }
    }, [onDecision])

    // ── Patch global fetch to detect bursts ───────────────────────────────────
    useEffect(() => {
        if (!enabled) return

        const originalFetch = window.fetch
        window.fetch = async function patchedFetch(...args) {
            let url: string | undefined
            const input = args[0]
            if (typeof input === 'string') {
                url = input
            } else if (input instanceof URL) {
                url = input.toString()
            } else if (input instanceof Request) {
                url = input.url
            }
            // Only track non-security calls to avoid circular scoring
            if (url && !url.includes('/api/security/') && !url.includes('/api/auth/check')) {
                const now = Date.now()
                fetchTimesRef.current = [
                    ...fetchTimesRef.current.filter(t => now - t < BURST_WINDOW_MS),
                    now,
                ]
                if (fetchTimesRef.current.length >= BURST_THRESHOLD) {
                    pushEvent('REQUEST_BURST')
                    fetchTimesRef.current = []  // reset to avoid repeated burst events
                }
                resetIdle()
            }
            return originalFetch.apply(window, args)
        }

        // User interaction events reset idle timer
        const handleActivity = () => resetIdle()
        window.addEventListener('mousemove', handleActivity, { passive: true })
        window.addEventListener('keydown', handleActivity, { passive: true })
        window.addEventListener('touchstart', handleActivity, { passive: true })

        // Start scoring interval
        scoreTimerRef.current = setInterval(scoreWindow, SCORE_INTERVAL_MS)
        resetIdle()

        return () => {
            window.fetch = originalFetch
            window.removeEventListener('mousemove', handleActivity)
            window.removeEventListener('keydown', handleActivity)
            window.removeEventListener('touchstart', handleActivity)
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
            if (scoreTimerRef.current) clearInterval(scoreTimerRef.current)
        }
    }, [enabled, pushEvent, resetIdle, scoreWindow])

    // ── Track page navigation ──────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled) return
        pushEvent('API_CALL_NORMAL')
        resetIdle()
    }, [pathname, enabled, pushEvent, resetIdle])

    return { pushEvent, scoreWindow }
}
