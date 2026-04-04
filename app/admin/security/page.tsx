'use client'

import { useEffect, useState, useCallback } from 'react'
import { Shield, AlertTriangle, Ban, ArrowUpCircle, Activity, Download, Tag, Copy, Check, Zap, Bot, Search, RefreshCw, RotateCcw, XCircle, Target, Radar, TrendingUp, Award, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface ModelMetrics {
    roc_auc: number
    pr_auc: number
    f1_score: number
    f1_attack: number
    f1_normal: number
    precision: number
    precision_attack: number
    precision_normal: number
    recall: number
    recall_attack: number
    recall_normal: number
    fpr: number
    fnr: number
    tn: number
    fp: number
    fn: number
    tp: number
    n_test_samples: number
    n_attack: number
    n_normal: number
    threshold_step_up?: number
    threshold_revoke?: number
    threshold_source?: string
    evaluated_at?: string
}

interface DashboardStats {
    totalSessions: number
    activeSessions: number
    revokedSessions: number
    stepUps: number
    revokes: number

    mlMetrics?: ModelMetrics
    mlComparison?: {
        lstm: ModelMetrics
        rule_based: ModelMetrics | null
        delta: Record<string, number>
    }
    riskScoreDistribution?: number[]
    ruleBasedStats?: {
        score: number
        ip_change: number
        ua_change: number
        device_change: number
        status_401: number
        status_403: number
        req_burst: number
    }
    recentEvents: Array<{
        sessionId: string
        eventType: string
        deltaT_ms: number
        ts: string
    }>
    recentSessions?: Array<{
        id: number
        sessionId: string
        createdAt: string
        revokedAt: string | null
        revokeReason: string | null
        rotationEnabled: boolean
        user?: { email: string }
    }>
    thresholds?: {
        stepUp: number
        revoke: number
        source: 'calibrated' | 'default'
    }
}

// ── Histogram component ────────────────────────────────────────────────────────

function RiskHistogram({ buckets, stepUp = 0.55, revoke = 0.80 }: {
    buckets: number[]
    stepUp?: number
    revoke?: number
}) {
    const max = Math.max(...buckets, 1)

    // Color each bucket based on its score vs thresholds
    const getBucketColor = (idx: number) => {
        const bucketMid = (idx + 0.5) / 20
        if (bucketMid >= revoke) return 'bg-red-500/70'
        if (bucketMid >= stepUp) return 'bg-orange-500/70'
        if (bucketMid >= stepUp * 0.7) return 'bg-yellow-500/70'
        return 'bg-green-500/70'
    }

    return (
        <div className="space-y-2">
            <div className="flex items-end gap-[2px] h-28">
                {buckets.map((count, i) => (
                    <div
                        key={i}
                        className={`flex-1 rounded-t-sm ${getBucketColor(i)} transition-all`}
                        style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? '2px' : '0' }}
                        title={`[${(i * 0.05).toFixed(2)}–${((i + 1) * 0.05).toFixed(2)}]: ${count} windows`}
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground px-0">
                <span>0.0</span>
                <span>{(stepUp * 0.5).toFixed(2)}</span>
                <span className="text-orange-400 font-medium">{stepUp.toFixed(2)} ← STEP_UP</span>
                <span className="text-red-400 font-medium">{revoke.toFixed(2)} ← REVOKE</span>
                <span>1.0</span>
            </div>
        </div>
    )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function SecurityDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [scoringMode, setScoringMode] = useState<'lstm' | 'rule_based'>('lstm')
    const [modeLoading, setModeLoading] = useState(false)
    const [modeError, setModeError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/admin/security/report')
            .then(r => r.json())
            .then(data => {
                setStats(data)
                setLoading(false)
            })
            .catch(() => {
                setError('Failed to load stats')
                setLoading(false)
            })
    }, [])

    // Fetch current scoring mode on mount
    useEffect(() => {
        fetch('/api/security/scoring-mode')
            .then(r => r.json())
            .then(data => setScoringMode(data.mode ?? 'lstm'))
            .catch(() => { })
    }, [])

    const handleSetMode = async (mode: 'lstm' | 'rule_based') => {
        if (mode === scoringMode || modeLoading) return
        setModeLoading(true)
        setModeError(null)
        try {
            const res = await fetch('/api/security/scoring-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            })
            const data = await res.json()
            if (!res.ok || data.error) {
                setModeError(data.error ?? 'Failed to update mode')
            } else if (data.mode) {
                setScoringMode(data.mode)
            }
        } catch {
            setModeError('Network error — could not update mode')
        } finally {
            setModeLoading(false)
        }
    }

    const handleExportCsv = () => {
        window.open('/api/admin/security/report?format=csv', '_blank')
    }

    const toggleRotation = async (targetSessionId: string, currentVal: boolean) => {
        try {
            const res = await fetch(`/api/admin/sessions/${targetSessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rotationEnabled: !currentVal })
            })
            if (res.ok) {
                // update local state
                setStats(prev => {
                    if (!prev || !prev.recentSessions) return prev
                    const newSessions = prev.recentSessions.map(s =>
                        s.sessionId === targetSessionId ? { ...s, rotationEnabled: !currentVal } : s
                    )
                    return { ...prev, recentSessions: newSessions }
                })
            }
        } catch (e) {
            console.error('Failed to toggle rotation', e)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    if (error || !stats) {
        return (
            <div className="p-6 text-center text-red-500">{error ?? 'An error occurred.'}</div>
        )
    }

    // Resolve active model metrics based on current scoring mode
    const activeM = stats.mlComparison
        ? (scoringMode === 'lstm' ? stats.mlComparison.lstm : stats.mlComparison.rule_based)
        : stats.mlMetrics ?? null

    const mlColor = scoringMode === 'lstm' ? 'text-indigo-400' : 'text-orange-400'

    const metricCards = [
        // ── ML metrics — update when mode changes ──────────────────────────────
        {
            title: 'ROC-AUC',
            value: activeM?.roc_auc?.toFixed(3) ?? 'N/A',
            icon: <Activity className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
        {
            title: 'PR-AUC',
            value: activeM?.pr_auc?.toFixed(3) ?? 'N/A',
            icon: <TrendingUp className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
        {
            title: 'F1 (Attack)',
            value: activeM?.f1_attack?.toFixed(3) ?? activeM?.f1_score?.toFixed(3) ?? 'N/A',
            icon: <Award className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
        {
            title: 'Precision (Attack)',
            value: activeM?.precision_attack?.toFixed(3) ?? activeM?.precision?.toFixed(3) ?? 'N/A',
            icon: <Target className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
        {
            title: 'Recall (Attack)',
            value: activeM?.recall_attack?.toFixed(3) ?? activeM?.recall?.toFixed(3) ?? 'N/A',
            icon: <Radar className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
        {
            title: 'FPR',
            value: activeM?.fpr !== undefined ? `${(activeM.fpr * 100).toFixed(1)}%` : 'N/A',
            icon: <ShieldAlert className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
        {
            title: 'FNR',
            value: activeM?.fnr !== undefined ? `${(activeM.fnr * 100).toFixed(1)}%` : 'N/A',
            icon: <AlertTriangle className={`h-5 w-5 ${mlColor}`} />,
            color: mlColor,
        },
    ]


    const eventBadgeColor: Record<string, string> = {
        AUTH_LOGIN_SUCCESS: 'bg-green-900 text-green-300',
        AUTH_LOGOUT: 'bg-gray-700 text-gray-300',
        TOKEN_ISSUE: 'bg-blue-900 text-blue-300',
        TOKEN_REFRESH: 'bg-blue-800 text-blue-200',
        TOKEN_ROTATE: 'bg-indigo-900 text-indigo-300',
        TOKEN_REVOKE: 'bg-red-900 text-red-300',
        API_CALL_NORMAL: 'bg-slate-800 text-slate-300',
        API_CALL_SENSITIVE: 'bg-orange-900 text-orange-300',
        FLAG_IP_CHANGE: 'bg-yellow-900 text-yellow-300',
        FLAG_UA_CHANGE: 'bg-yellow-800 text-yellow-200',
        STEP_UP_FAILED: 'bg-red-800 text-red-200',
        STATUS_401: 'bg-red-900 text-red-300',
        STATUS_403: 'bg-red-900 text-red-300',
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="h-7 w-7 text-primary" />
                        Security Dashboard
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Session Hijacking Detection &mdash; Active mode:&nbsp;
                        <span className={scoringMode === 'lstm' ? 'text-blue-400 font-medium' : 'text-orange-400 font-medium'}>
                            {scoringMode === 'lstm' ? 'LSTM Supervised' : 'Rule-Based'}
                        </span>
                    </p>
                </div>
                <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Detection Mode Panel */}
            <Card className="border-border/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        Detection Mode
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Select which scoring mechanism is used for all active sessions. Changes take effect immediately.
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-3 max-w-xl">
                        {/* LSTM mode card */}
                        <button
                            id="mode-btn-lstm"
                            onClick={() => handleSetMode('lstm')}
                            disabled={modeLoading}
                            className={`rounded-lg border p-4 text-left transition-all ${scoringMode === 'lstm'
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-border/50 hover:border-blue-500/40 hover:bg-blue-500/5'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Bot className="h-5 w-5 text-blue-400" />
                                {scoringMode === 'lstm' && (
                                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                                        ACTIVE
                                    </Badge>
                                )}
                            </div>
                            <div className="font-semibold text-sm">LSTM Supervised</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Binary classifier · P(ATTACK) ∈ [0,1] · Detects slow attacks
                            </div>
                        </button>

                        {/* Rule-based mode card */}
                        <button
                            id="mode-btn-rule-based"
                            onClick={() => handleSetMode('rule_based')}
                            disabled={modeLoading}
                            className={`rounded-lg border p-4 text-left transition-all ${scoringMode === 'rule_based'
                                ? 'border-orange-500 bg-orange-500/10'
                                : 'border-border/50 hover:border-orange-500/40 hover:bg-orange-500/5'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Zap className="h-5 w-5 text-orange-400" />
                                {scoringMode === 'rule_based' && (
                                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">
                                        ACTIVE
                                    </Badge>
                                )}
                            </div>
                            <div className="font-semibold text-sm">Rule-Based</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Flag-weighted score · Normalized [0,1] · Interpretable baseline
                            </div>
                        </button>
                    </div>

                    {/* Status feedback */}
                    {modeLoading && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                            <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            Applying mode change…
                        </p>
                    )}
                    {modeError && (
                        <p className="text-xs text-red-400 mt-3">⚠ {modeError}</p>
                    )}
                </CardContent>
            </Card>

            {/* Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {metricCards.map(card => (
                    <Card key={card.title} className="border-border/50">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
                            {card.icon}
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Risk Score Histogram */}
            {stats.riskScoreDistribution && (
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="text-base">Risk Score Distribution (Test Set)</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Histogram of P(ATTACK) across {activeM?.n_test_samples ?? stats.mlMetrics?.n_test_samples ?? '?'} test windows
                            ({activeM?.n_attack ?? stats.mlMetrics?.n_attack ?? '?'} attack&nbsp;/&nbsp;
                            {activeM?.n_normal ?? stats.mlMetrics?.n_normal ?? '?'} normal).
                            Normal windows should cluster near 0; attack windows near 1.
                        </p>
                        {activeM?.evaluated_at && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                Last evaluated: {new Date(activeM.evaluated_at).toLocaleString()}
                            </p>
                        )}
                        {stats.thresholds && (
                            <div className="flex gap-3 text-xs mt-1">
                                <span className="text-orange-400">STEP_UP ≥ <strong>{stats.thresholds.stepUp.toFixed(2)}</strong></span>
                                <span className="text-red-400">REVOKE ≥ <strong>{stats.thresholds.revoke.toFixed(2)}</strong></span>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        <RiskHistogram
                            buckets={stats.riskScoreDistribution}
                            stepUp={stats.thresholds?.stepUp}
                            revoke={stats.thresholds?.revoke}
                        />
                    </CardContent>
                </Card>
            )}




            {/* Recent Events Table */}
            <Card className="border-border/50">
                <CardHeader>
                    <CardTitle className="text-base">Recent Session Events</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.recentEvents.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-8">
                            No events yet. Begin logging sessions to see data here.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Session ID</th>
                                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Event</th>
                                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Δt (ms)</th>
                                        <th className="text-left py-2 font-medium text-muted-foreground">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentEvents.map((event, i) => (
                                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                                            <td className="py-2 pr-4">
                                                <SessionIdCell sessionId={event.sessionId} />
                                            </td>
                                            <td className="py-2 pr-4">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${eventBadgeColor[event.eventType] ?? 'bg-muted text-muted-foreground'}`}>
                                                    {event.eventType}
                                                </span>
                                            </td>
                                            <td className="py-2 pr-4 tabular-nums">{event.deltaT_ms.toLocaleString()}</td>
                                            <td className="py-2 text-muted-foreground text-xs">
                                                {new Date(event.ts).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Sessions Table */}
            {stats.recentSessions && (
                <Card className="border-border/50 mt-6">
                    <CardHeader>
                        <CardTitle className="text-base">Recent Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.recentSessions.length === 0 ? (
                            <p className="text-muted-foreground text-sm text-center py-8">
                                No sessions recorded.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50">
                                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Session ID</th>
                                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">User Email</th>
                                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Status & Reason</th>
                                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Token Rotation</th>
                                            <th className="text-left py-2 font-medium text-muted-foreground">Created At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recentSessions.map((session, i) => (
                                            <tr key={session.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                                                <td className="py-2 pr-4">
                                                    <SessionIdCell sessionId={session.sessionId} />
                                                </td>
                                                <td className="py-2 pr-4 truncate max-w-[150px]" title={session.user?.email}>
                                                    {session.user?.email || 'Unknown'}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    {session.revokedAt ? (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="destructive" className="w-fit">Revoked</Badge>
                                                            <span className="text-[10px] text-muted-foreground max-w-[200px] truncate" title={session.revokeReason || ''}>
                                                                {session.revokeReason || 'No reason specified'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 w-fit">Active</Badge>
                                                    )}
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => toggleRotation(session.sessionId, session.rotationEnabled)}
                                                        className={session.rotationEnabled ? 'border-green-500 text-green-500 hover:bg-green-500/10 hover:text-green-600' : 'border-slate-500 text-slate-500 hover:bg-slate-500/10'}
                                                    >
                                                        {session.rotationEnabled ? 'Enabled' : 'Disabled'}
                                                    </Button>
                                                </td>
                                                <td className="py-2 text-muted-foreground text-xs whitespace-nowrap">
                                                    {new Date(session.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Session Manager */}
            <SessionManagerPanel />


            {/* Admin Label Panel */}
            <LabelSessionPanel />

        </div>
    )
}

// ── Session Manager Panel ──────────────────────────────────────────────────────

interface SessionRow {
    id: number
    sessionId: string
    rotationEnabled: boolean
    expiresAt: string
    revokedAt: string | null
    revokeReason: string | null
    createdAt: string
    user?: { id: number; email: string; firstName: string; lastName: string | null }
    _count?: { events: number; auditLogs: number }
}

function SessionManagerPanel() {
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState<'all' | 'active' | 'revoked' | 'expired'>('all')
    const [loading, setLoading] = useState(false)
    const [revoking, setRevoking] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)
    const LIMIT = 10

    const fetchSessions = useCallback(async (p = page, q = search, s = status) => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(p), limit: String(LIMIT), status: s, search: q
            })
            const res = await fetch(`/api/admin/sessions?${params}`)
            if (res.ok) {
                const data = await res.json()
                setSessions(data.sessions)
                setTotal(data.total)
                setPages(data.pages)
                setPage(data.page)
            }
        } catch { /* non-fatal */ }
        finally { setLoading(false) }
    }, [page, search, status])

    useEffect(() => { fetchSessions(1, search, status) }, [status]) // eslint-disable-line

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchSessions(1, search, status)
    }

    const handleRevoke = async (sessionId: string) => {
        if (!confirm(`Revoke session ${sessionId.slice(0, 12)}…?\nThis will log the user out immediately.`)) return
        setRevoking(sessionId)
        try {
            const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' })
            if (res.ok) {
                setSessions(prev => prev.map(s =>
                    s.sessionId === sessionId
                        ? { ...s, revokedAt: new Date().toISOString(), revokeReason: 'admin_manual_revoke' }
                        : s
                ))
            }
        } catch { /* non-fatal */ }
        finally { setRevoking(null) }
    }

    const handleToggleRotation = async (sessionId: string, current: boolean) => {
        setToggling(sessionId)
        try {
            const res = await fetch(`/api/admin/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rotationEnabled: !current }),
            })
            if (res.ok) {
                setSessions(prev => prev.map(s =>
                    s.sessionId === sessionId ? { ...s, rotationEnabled: !current } : s
                ))
            }
        } catch { /* non-fatal */ }
        finally { setToggling(null) }
    }

    return (
        <Card className="border-border/50">
            <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            Session Manager
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {total} session{total !== 1 ? 's' : ''} total — page {page}/{pages}
                        </p>
                    </div>
                    {/* Status filter */}
                    <div className="flex items-center gap-2">
                        {(['all', 'active', 'revoked', 'expired'] as const).map(s => (
                            <button key={s}
                                onClick={() => setStatus(s)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${status === s
                                    ? s === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                        : s === 'revoked' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                            : s === 'expired' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                    : 'bg-muted/40 text-muted-foreground border border-border/40 hover:bg-muted/60'
                                    }`}
                            >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                        <button onClick={() => fetchSessions(page, search, status)} title="Refresh"
                            className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground transition-colors">
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
                {/* Search bar */}
                <form onSubmit={handleSearch} className="flex gap-2 mt-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            className="pl-8 h-8 text-sm"
                            placeholder="Search by email or Session ID…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Button type="submit" size="sm" variant="outline" className="h-8 px-3">Search</Button>
                </form>
            </CardHeader>

            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">No sessions found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Session ID</th>
                                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">User</th>
                                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Revoke Reason</th>
                                    <th className="text-center py-2 pr-3 font-medium text-muted-foreground">Events</th>
                                    <th className="text-center py-2 pr-3 font-medium text-muted-foreground">Token Rotation</th>
                                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Created</th>
                                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Expires</th>
                                    <th className="text-center py-2 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map(s => {
                                    const isRevoked = !!s.revokedAt
                                    const isExpired = !isRevoked && new Date(s.expiresAt) < new Date()
                                    return (
                                        <tr key={s.id} className={`border-b border-border/20 transition-colors hover:bg-muted/10 ${isRevoked ? 'opacity-60' : ''}`}>
                                            {/* Session ID */}
                                            <td className="py-2 pr-3">
                                                <SessionIdCell sessionId={s.sessionId} />
                                            </td>
                                            {/* User */}
                                            <td className="py-2 pr-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-xs">{s.user?.email ?? '—'}</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {s.user ? `${s.user.firstName} ${s.user.lastName ?? ''}`.trim() : ''}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Status */}
                                            <td className="py-2 pr-3">
                                                {isRevoked ? (
                                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Revoked</Badge>
                                                ) : isExpired ? (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-400 border-orange-400/50">Expired</Badge>
                                                ) : (
                                                    <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">Active</Badge>
                                                )}
                                            </td>
                                            {/* Revoke reason */}
                                            <td className="py-2 pr-3 max-w-[160px]">
                                                {s.revokeReason ? (
                                                    <span className="text-[10px] text-red-400/80 truncate block" title={s.revokeReason}>
                                                        {s.revokeReason}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            {/* Event count */}
                                            <td className="py-2 pr-3 text-center tabular-nums text-xs text-muted-foreground">
                                                {s._count?.events ?? 0}
                                            </td>
                                            {/* Token rotation toggle */}
                                            <td className="py-2 pr-3 text-center">
                                                <button
                                                    id={`rotation-${s.sessionId.slice(0, 8)}`}
                                                    disabled={isRevoked || toggling === s.sessionId}
                                                    onClick={() => handleToggleRotation(s.sessionId, s.rotationEnabled)}
                                                    title={s.rotationEnabled ? 'Click to disable rotation' : 'Click to enable rotation'}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all border ${isRevoked ? 'opacity-40 cursor-not-allowed border-border/30 text-muted-foreground'
                                                        : s.rotationEnabled
                                                            ? 'border-green-500/50 text-green-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50'
                                                            : 'border-slate-500/50 text-slate-400 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/50'
                                                        }`}
                                                >
                                                    <RotateCcw className="h-2.5 w-2.5" />
                                                    {toggling === s.sessionId ? '…' : s.rotationEnabled ? 'ON' : 'OFF'}
                                                </button>
                                            </td>
                                            {/* Created */}
                                            <td className="py-2 pr-3 text-[10px] text-muted-foreground whitespace-nowrap">
                                                {new Date(s.createdAt).toLocaleString()}
                                            </td>
                                            {/* Expires */}
                                            <td className="py-2 pr-3 text-[10px] text-muted-foreground whitespace-nowrap">
                                                <span className={isExpired && !isRevoked ? 'text-orange-400' : ''}>
                                                    {new Date(s.expiresAt).toLocaleString()}
                                                </span>
                                            </td>
                                            {/* Actions */}
                                            <td className="py-2 text-center">
                                                {!isRevoked && (
                                                    <button
                                                        id={`revoke-${s.sessionId.slice(0, 8)}`}
                                                        disabled={revoking === s.sessionId}
                                                        onClick={() => handleRevoke(s.sessionId)}
                                                        title="Revoke session"
                                                        className="p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
                                                    >
                                                        {revoking === s.sessionId
                                                            ? <span className="inline-block h-4 w-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                                                            : <XCircle className="h-4 w-4" />
                                                        }
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
                        <p className="text-xs text-muted-foreground">{total} sessions — page {page} of {pages}</p>
                        <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs"
                                disabled={page <= 1 || loading}
                                onClick={() => { setPage(1); fetchSessions(1, search, status) }}
                                title="First page">
                                {'<<'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs"
                                disabled={page <= 1 || loading}
                                onClick={() => { const p = page - 1; setPage(p); fetchSessions(p, search, status) }}
                                title="Previous page">
                                {'<'}
                            </Button>
                            
                            <div className="h-7 px-3 flex items-center justify-center border border-border/50 rounded-md bg-muted/10 text-xs font-semibold">
                                {page}
                            </div>
                            
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs"
                                disabled={page >= pages || loading}
                                onClick={() => { const p = page + 1; setPage(p); fetchSessions(p, search, status) }}
                                title="Next page">
                                {'>'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-xs"
                                disabled={page >= pages || loading}
                                onClick={() => { setPage(pages); fetchSessions(pages, search, status) }}
                                title="Last page">
                                {'>>'}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ── Session ID Cell with copy button ──────────────────────────────────────────

function SessionIdCell({ sessionId }: { sessionId: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(sessionId).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }, [sessionId])

    return (
        <div className="flex items-center gap-1.5 group">
            <span className="font-mono text-xs text-muted-foreground truncate max-w-[160px]" title={sessionId}>
                {sessionId}
            </span>
            <button
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                title="Copy session ID"
            >
                {copied
                    ? <Check className="h-3.5 w-3.5 text-green-400" />
                    : <Copy className="h-3.5 w-3.5" />
                }
            </button>
        </div>
    )
}

// ── Admin Label Panel ──────────────────────────────────────────────────────────

interface LabelResult {
    success: boolean
    sessionId: string
    label: string
    message?: string
    error?: string
}

function LabelSessionPanel() {
    const [sessionId, setSessionId] = useState('')
    const [label, setLabel] = useState<'ATTACK' | 'NORMAL'>('ATTACK')
    const [reason, setReason] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<LabelResult | null>(null)

    const handleSubmit = async () => {
        if (!sessionId.trim()) return
        setLoading(true)
        setResult(null)
        try {
            const res = await fetch('/api/admin/security/label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: sessionId.trim(), label, reason }),
            })
            const data = await res.json() as LabelResult
            setResult(data)
        } catch (e) {
            setResult({ success: false, sessionId, label, error: String(e) })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-border/50">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    Manual Session Labeling
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Mark a session as ATTACK or NORMAL. Re-run <code>label_builder.py</code> afterward to update the training dataset.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        id="label-session-id"
                        placeholder="Session ID (e.g. sess_abc123…)"
                        value={sessionId}
                        onChange={e => setSessionId(e.target.value)}
                        className="font-mono text-sm h-9"
                    />
                    {/* Label toggle buttons using shadcn Button for style consistency */}
                    <div className="flex gap-1 shrink-0">
                        <Button
                            size="sm"
                            variant={label === 'ATTACK' ? 'destructive' : 'outline'}
                            onClick={() => setLabel('ATTACK')}
                            className="h-9 px-3"
                        >
                            ATTACK
                        </Button>
                        <Button
                            size="sm"
                            variant={label === 'NORMAL' ? 'default' : 'outline'}
                            onClick={() => setLabel('NORMAL')}
                            className="h-9 px-3"
                        >
                            NORMAL
                        </Button>
                    </div>
                </div>

                <Textarea
                    placeholder="Reason (optional) – e.g. 'IP change detected from log review'"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                />

                <Button
                    onClick={handleSubmit}
                    disabled={loading || !sessionId.trim()}
                    className="gap-2"
                    variant={label === 'ATTACK' ? 'destructive' : 'default'}
                >
                    <Tag className="h-4 w-4" />
                    {loading ? 'Labeling…' : `Mark as ${label}`}
                </Button>

                {result && (
                    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-md border-l-4 bg-muted/60 text-sm ${result.success
                        ? 'border-l-green-500'
                        : 'border-l-destructive'
                        }`}>
                        <span className={`font-mono text-xs leading-relaxed ${result.success ? 'text-green-400' : 'text-destructive'
                            }`}>
                            {result.success ? '✓ ' : '✗ '}
                            {result.success ? result.message : result.error}
                        </span>
                    </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                    After labeling, run:{' '}
                    <code className="bg-muted px-1 py-0.5 rounded">python ml/label_builder.py</code>
                    {' → '}<code className="bg-muted px-1 py-0.5 rounded">python ml/feature_builder.py</code>
                    {' → '}<code className="bg-muted px-1 py-0.5 rounded">python ml/train.py</code>
                </p>
            </CardContent>
        </Card>
    )
}
