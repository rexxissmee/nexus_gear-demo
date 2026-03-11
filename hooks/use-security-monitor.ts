'use client'
/**
 * useSecurityMonitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side security hook that:
 *  1. Buffers user events into a sliding window
 *  2. Detects: idle → SESSION_IDLE_LONG, burst → REQUEST_BURST,
 *              device change → FLAG_DEVICE_CHANGE, geo change → FLAG_GEO_CHANGE
 *  3. Persists flag events to POST /api/security/event (event store)
 *  4. Periodically scores the current window via POST /api/security/score
 *  5. Returns policy decision so the caller can react (WARN / STEP_UP / REVOKE)
 */

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ── Config ────────────────────────────────────────────────────────────────────
const SCORE_INTERVAL_MS = 10_000   // score window every 10s
const IDLE_TIMEOUT_MS   = 5 * 60_000  // 5 min idle → SESSION_IDLE_LONG
const BURST_WINDOW_MS   = 3_000    // look-back window for burst detection
const BURST_THRESHOLD   = 5        // ≥5 fetches in BURST_WINDOW_MS → REQUEST_BURST
const MAX_WINDOW_EVENTS = 30       // sliding window size (= LSTM window_length)

// Storage key for device/geo fingerprint
const DEVICE_FINGERPRINT_KEY = '__ng_dfp'
const GEO_FINGERPRINT_KEY    = '__ng_gfp'

// ── Types ─────────────────────────────────────────────────────────────────────
export type SecurityEvent = {
    event_type: string
    delta_t_ms: number
    flags: Record<string, number>
    ts: number
}

export type PolicyDecision = 'NONE' | 'WARN' | 'STEP_UP' | 'REVOKE'

export interface ScoreResult {
    decision: PolicyDecision
    anomaly_score: number
    risk_ema: number
    reason?: string
}

// ── Device fingerprint (non-PII: screen dimensions + pixel ratio) ─────────────
function getDeviceFingerprint(): string {
    return `${screen.width}x${screen.height}x${Math.round(window.devicePixelRatio * 10)}`
}

// ── Geo fingerprint (timezone string only, no coordinates) ────────────────────
function getGeoFingerprint(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
    } catch {
        return 'unknown'
    }
}

// ── Main Hook ─────────────────────────────────────────────────────────────────
export function useSecurityMonitor(opts: {
    enabled: boolean
    onDecision?: (result: ScoreResult) => void
}) {
    const { enabled, onDecision } = opts
    const pathname = usePathname()

    // Buffers
    const windowRef     = useRef<SecurityEvent[]>([])
    const fetchTimesRef = useRef<number[]>([])

    // Timers
    const idleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Last event ts for delta_t
    const lastTsRef = useRef<number>(Date.now())

    // ── Add event to sliding window (in-memory) ───────────────────────────────
    const pushEvent = useCallback((type: string, flags: Record<string, number> = {}) => {
        const now = Date.now()
        const delta_t_ms = now - lastTsRef.current
        lastTsRef.current = now
        const ev: SecurityEvent = { event_type: type, delta_t_ms, flags, ts: now }
        windowRef.current = [...windowRef.current.slice(-(MAX_WINDOW_EVENTS - 1)), ev]
    }, [])

    // ── Persist event to event store (non-fatal) ──────────────────────────────
    const persistEvent = useCallback(async (type: string, flags: Record<string, number> = {}) => {
        const sessionId = document.cookie.match(/(?:^|; )session_id=([^;]+)/)?.[1]
        if (!sessionId) return
        try {
            await fetch('/api/security/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId,
                },
                body: JSON.stringify({ event_type: type, flags }),
            })
        } catch {
            // Non-fatal — don't disrupt user
        }
    }, [])

    // ── Helper: push + persist ────────────────────────────────────────────────
    const logFlagEvent = useCallback((type: string, flags: Record<string, number> = {}) => {
        pushEvent(type, flags)
        persistEvent(type, flags)
    }, [pushEvent, persistEvent])

    // ── Check device fingerprint change ────────────────────────────────────────
    const checkDeviceChange = useCallback(() => {
        const current = getDeviceFingerprint()
        const stored  = sessionStorage.getItem(DEVICE_FINGERPRINT_KEY)
        if (stored === null) {
            sessionStorage.setItem(DEVICE_FINGERPRINT_KEY, current)
        } else if (stored !== current) {
            sessionStorage.setItem(DEVICE_FINGERPRINT_KEY, current)
            logFlagEvent('FLAG_DEVICE_CHANGE', { device_change: 1 })
        }
    }, [logFlagEvent])

    // ── Check geo (timezone) fingerprint change ────────────────────────────────
    const checkGeoChange = useCallback(() => {
        const current = getGeoFingerprint()
        const stored  = sessionStorage.getItem(GEO_FINGERPRINT_KEY)
        if (stored === null) {
            sessionStorage.setItem(GEO_FINGERPRINT_KEY, current)
        } else if (stored !== current) {
            sessionStorage.setItem(GEO_FINGERPRINT_KEY, current)
            logFlagEvent('FLAG_GEO_CHANGE', { geo_change: 1 })
        }
    }, [logFlagEvent])

    // ── Reset idle timer ───────────────────────────────────────────────────────
    const resetIdle = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
            logFlagEvent('SESSION_IDLE_LONG')
        }, IDLE_TIMEOUT_MS)
    }, [logFlagEvent])

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
            // Network errors are silent
        }
    }, [onDecision])

    // ── Patch global fetch to detect bursts ───────────────────────────────────
    useEffect(() => {
        if (!enabled) return

        const originalFetch = window.fetch
        window.fetch = async function patchedFetch(...args) {
            let url: string | undefined
            const input = args[0]
            if (typeof input === 'string')        url = input
            else if (input instanceof URL)        url = input.toString()
            else if (input instanceof Request)    url = input.url

            // Only track non-security calls to avoid circular scoring
            if (url && !url.includes('/api/security/') && !url.includes('/api/auth/check')) {
                const now = Date.now()
                fetchTimesRef.current = [
                    ...fetchTimesRef.current.filter(t => now - t < BURST_WINDOW_MS),
                    now,
                ]
                if (fetchTimesRef.current.length >= BURST_THRESHOLD) {
                    logFlagEvent('REQUEST_BURST')
                    fetchTimesRef.current = []
                }
                resetIdle()
            }
            return originalFetch.apply(window, args)
        }

        // User interaction events reset idle timer
        const handleActivity = () => resetIdle()
        window.addEventListener('mousemove',   handleActivity, { passive: true })
        window.addEventListener('keydown',     handleActivity, { passive: true })
        window.addEventListener('touchstart',  handleActivity, { passive: true })

        // Check device + geo on mount
        checkDeviceChange()
        checkGeoChange()

        // Start scoring interval
        scoreTimerRef.current = setInterval(scoreWindow, SCORE_INTERVAL_MS)
        resetIdle()

        return () => {
            window.fetch = originalFetch
            window.removeEventListener('mousemove',  handleActivity)
            window.removeEventListener('keydown',    handleActivity)
            window.removeEventListener('touchstart', handleActivity)
            if (idleTimerRef.current)  clearTimeout(idleTimerRef.current)
            if (scoreTimerRef.current) clearInterval(scoreTimerRef.current)
        }
    }, [enabled, logFlagEvent, resetIdle, scoreWindow, checkDeviceChange, checkGeoChange])

    // ── Track page navigation ──────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled) return
        pushEvent('API_CALL_NORMAL')
        resetIdle()
        // Re-check device/geo on every navigation (lazy SPA detection)
        checkDeviceChange()
        checkGeoChange()
    }, [pathname, enabled, pushEvent, resetIdle, checkDeviceChange, checkGeoChange])

    return { pushEvent, scoreWindow }
}
