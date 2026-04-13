'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    FlaskConical, Play, Shield, Brain,
    AlertTriangle, CheckCircle2, XCircle,
    RefreshCw, Activity, Clock, Info, BarChart3, Eye,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth-store'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioMeta {
    id: string
    name: string
    description: string
    threat_level: 'low' | 'medium' | 'high' | 'critical'
    mitre_technique: string
    event_count: number
}

interface RuleBreakdown {
    feature: string
    value: number
    weight: number
    contribution: number
}

interface RunResult {
    scenario: { id: string; name: string; threat_level: string; mitre_technique: string }
    events_logged: Array<{ event_type: string; delta_t_ms: number; flags: Record<string, number> }>
    scoring: {
        model_used: string
        rule_score: number
        lstm_score: number | null
        lstm_predicted_label: string | null
        lstm_class_probs: { NORMAL: number; ATTACK: number } | null
        lstm_error: string | null
        window_score: number
        risk_ema: number
        decision: 'NONE' | 'STEP_UP' | 'REVOKE'
        reason: string | null
    }
    rule_breakdown: RuleBreakdown[]
    rule_weights_info: { max_raw: number; thresholds: { step_up: number; revoke: number } }
}

interface LiveEvent {
    id: number
    eventType: string
    deltaT_ms: number
    flags: Record<string, number>
    ts: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const THREAT_BADGE: Record<string, string> = {
    low:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    medium:   'bg-yellow-100  text-yellow-800  dark:bg-yellow-900/40  dark:text-yellow-300',
    high:     'bg-orange-100  text-orange-800  dark:bg-orange-900/40  dark:text-orange-300',
    critical: 'bg-red-100     text-red-800     dark:bg-red-900/40     dark:text-red-300',
}

const DECISION_CFG: Record<string, { bg: string; border: string; text: string; icon: React.ElementType; label: string; sub: string }> = {
    NONE: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-800 dark:text-emerald-300', icon: CheckCircle2,
        label: 'No Action Taken', sub: 'Risk score is below both thresholds. Session continues normally.',
    },
    STEP_UP: {
        bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-800 dark:text-yellow-300', icon: AlertTriangle,
        label: 'Step-Up Authentication Triggered', sub: 'User must complete MFA before accessing sensitive endpoints.',
    },
    REVOKE: {
        bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-300', icon: XCircle,
        label: 'Session Revoked', sub: 'Session has been invalidated in the database. User must log in again.',
    },
}

const EVENT_DOT: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: '#16a34a', TOKEN_ISSUE: '#2563eb', TOKEN_ROTATE: '#7c3aed',
    TOKEN_REFRESH: '#9333ea',     TOKEN_REVOKE: '#dc2626', API_CALL_NORMAL: '#94a3b8',
    API_CALL_SENSITIVE: '#d97706', FLAG_IP_CHANGE: '#ea580c', FLAG_UA_CHANGE: '#f97316',
    FLAG_DEVICE_CHANGE: '#dc2626', FLAG_GEO_CHANGE: '#b91c1c', STATUS_401: '#dc2626',
    REQUEST_BURST: '#ea580c',     SESSION_IDLE_LONG: '#64748b',
    STEP_UP_REQUIRED: '#d97706',  STEP_UP_FAILED: '#dc2626',
}

const FEATURE_LABEL: Record<string, string> = {
    ip_change: 'IP Change',       ua_change: 'UA Change',
    device_change: 'Device Change', geo_change: 'Geo Change',
    status_401: 'Status 401',     status_403: 'Status 403',
    req_burst: 'Request Burst',   api_sensitive: 'Sensitive API Calls',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColorCls(s: number) {
    if (s >= 0.55) return 'text-red-600 dark:text-red-400'
    if (s >= 0.30) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-emerald-600 dark:text-emerald-400'
}

function barFillCls(s: number) {
    if (s >= 0.55) return 'bg-red-500'
    if (s >= 0.30) return 'bg-yellow-500'
    return 'bg-emerald-500'
}

function ScoreRow({ label, value, note }: { label: string; value: number; note?: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <span className={`text-sm font-mono font-bold ${scoreColorCls(value)}`}>{value.toFixed(3)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${barFillCls(value)}`}
                    style={{ width: `${Math.min(value * 100, 100)}%` }}
                />
            </div>
            {note && <p className="text-[11px] text-gray-400">{note}</p>}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AttackLabPage() {
    const setStepUp = useAuthStore(s => s.setStepUp)
    const logout = useAuthStore(s => s.logout)
    const router = useRouter()

    const [scenarios, setScenarios]     = useState<ScenarioMeta[]>([])
    const [selected, setSelected]       = useState<string>('normal')
    const [model, setModel]             = useState<'rule_based' | 'lstm'>('rule_based')
    const [running, setRunning]         = useState(false)
    const [result, setResult]           = useState<RunResult | null>(null)
    const [liveEvents, setLiveEvents]   = useState<LiveEvent[]>([])
    const [loadingList, setLoadingList] = useState(true)
    const [activeTab, setActiveTab]     = useState<'events' | 'breakdown' | 'feed'>('events')

    useEffect(() => {
        fetch('/api/demo/run-scenario')
            .then(r => r.json())
            .then(d => { setScenarios(d.scenarios ?? []); setLoadingList(false) })
            .catch(() => setLoadingList(false))
    }, [])

    const refreshFeed = useCallback(async () => {
        const r = await fetch('/api/demo/session-events').catch(() => null)
        if (r?.ok) setLiveEvents((await r.json()).events ?? [])
    }, [])

    useEffect(() => {
        refreshFeed()
        const id = setInterval(refreshFeed, 5000)
        return () => clearInterval(id)
    }, [refreshFeed])

    const scenario = scenarios.find(s => s.id === selected)

    async function run() {
        if (!selected || running) return
        setRunning(true); setResult(null); setActiveTab('events')
        try {
            const res = await fetch('/api/demo/run-scenario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario_id: selected, model }),
            })
            const data: RunResult = await res.json()
            if (!res.ok) throw new Error((data as never as { error: string }).error)
            setResult(data)
            await refreshFeed()
            if (data.scoring.decision === 'REVOKE') {
                toast.error('🚨 Session revoked — user must re-authenticate', { duration: 6000 })
                logout().then(() => router.replace('/auth?reason=session_revoked'))
            } else if (data.scoring.decision === 'STEP_UP') {
                toast.warning('⚠️ Step-up MFA required before next sensitive action', { duration: 5000 })
                setStepUp(true, data.scoring.reason || 'Anomalous behavior detected in Demo lab')
            } else {
                toast.success('✅ No anomaly — session continues normally')
            }
        } catch (e) {
            toast.error(`Error: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setRunning(false)
        }
    }

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <FlaskConical className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Attack Scenario Lab</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Simulate real attack patterns and observe live detection and enforcement
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

                {/* ══ LEFT ══ */}
                <div className="lg:col-span-2 space-y-4">

                    {/* Model selector */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                                Detection Model
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { id: 'rule_based', label: 'Rule-Based', Icon: Shield, sub: 'Weighted flags' },
                                    { id: 'lstm',       label: 'LSTM',       Icon: Brain,  sub: 'Sequence model' },
                                ] as const).map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setModel(m.id)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 text-center
                                            transition-all text-sm font-medium cursor-pointer
                                            ${model === m.id
                                                ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <m.Icon className="w-5 h-5" />
                                        <div>
                                            <p>{m.label}</p>
                                            <p className="text-xs font-normal text-gray-400 mt-0.5">{m.sub}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Scenario list */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                                Attack Scenario
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[460px] overflow-y-auto">
                                {loadingList ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                                    </div>
                                ) : scenarios.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => { setSelected(s.id); setResult(null) }}
                                        className={`w-full text-left px-4 py-3 transition-colors
                                            ${selected === s.id
                                                ? 'bg-violet-50 dark:bg-violet-900/20'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className={`text-sm font-medium truncate
                                                ${selected === s.id ? 'text-violet-700 dark:text-violet-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {s.name}
                                            </span>
                                            <Badge className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 ${THREAT_BADGE[s.threat_level]}`}>
                                                {s.threat_level.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{s.description}</p>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Scenario info + run */}
                    {scenario && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">{scenario.name}</CardTitle>
                                <CardDescription className="text-xs font-mono">{scenario.mitre_technique}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={run}
                                    disabled={running}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                    {running ? (
                                        <>
                                            <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin mr-2" />
                                            Running scenario…
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2" />
                                            Run with {model === 'rule_based' ? 'Rule-Based' : 'LSTM'}
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* ══ RIGHT ══ */}
                <div className="lg:col-span-3 space-y-4">

                    {/* Risk Monitor */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-violet-500" />
                                <CardTitle className="text-base">Risk Monitor</CardTitle>
                            </div>
                            {result && (() => {
                                const d = DECISION_CFG[result.scoring.decision]
                                return (
                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${d.bg} ${d.border} ${d.text}`}>
                                        <d.icon className="w-3.5 h-3.5" />
                                        {result.scoring.decision}
                                    </div>
                                )
                            })()}
                        </CardHeader>

                        <CardContent>
                            {result ? (
                                <div className="space-y-5">
                                    {/* Scores */}
                                    <div className="space-y-4">
                                        <ScoreRow
                                            label="Rule-Based Score"
                                            value={result.scoring.rule_score}
                                            note="step-up ≥ 0.30 · revoke ≥ 0.55"
                                        />
                                        {result.scoring.lstm_score !== null && (
                                            <ScoreRow
                                                label={`LSTM Score${result.scoring.lstm_predicted_label ? ` — ${result.scoring.lstm_predicted_label}` : ''}`}
                                                value={result.scoring.lstm_score}
                                                note="step-up ≥ 0.30 · revoke ≥ 0.75"
                                            />
                                        )}
                                        <ScoreRow
                                            label="EMA Risk"
                                            value={result.scoring.risk_ema}
                                            note={`Smoothed score used by policy engine · model: ${result.scoring.model_used.toUpperCase()}`}
                                        />
                                        {result.scoring.lstm_class_probs && (
                                            <div className="grid grid-cols-2 gap-3 pt-1">
                                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 text-center">
                                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                        {(result.scoring.lstm_class_probs.NORMAL * 100).toFixed(1)}%
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">P(Normal)</p>
                                                </div>
                                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 text-center">
                                                    <p className={`text-lg font-bold font-mono ${scoreColorCls(result.scoring.lstm_class_probs.ATTACK)}`}>
                                                        {(result.scoring.lstm_class_probs.ATTACK * 100).toFixed(1)}%
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-0.5">P(Attack)</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Policy enforcement banner */}
                                    {(() => {
                                        const d = DECISION_CFG[result.scoring.decision]
                                        return (
                                            <div className={`flex items-start gap-3 p-4 rounded-lg border ${d.bg} ${d.border}`}>
                                                <d.icon className={`w-5 h-5 shrink-0 mt-0.5 ${d.text}`} />
                                                <div>
                                                    <p className={`text-sm font-semibold ${d.text}`}>{d.label}</p>
                                                    <p className={`text-xs mt-1 ${d.text} opacity-75`}>{d.sub}</p>
                                                    {result.scoring.reason && (
                                                        <p className="text-xs mt-2 text-gray-500 dark:text-gray-400 font-mono bg-white/50 dark:bg-black/20 rounded px-2 py-1">
                                                            {result.scoring.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    {/* LSTM unavailable */}
                                    {result.scoring.lstm_error && (
                                        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                                            <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                <span className="font-semibold">LSTM unavailable</span> — Python env or trained model not found. Using rule-based score.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                        <Play className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Select a scenario and press Run</p>
                                        <p className="text-xs text-gray-400 mt-1">Events are logged to your session and scored in real-time</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Detail tabs */}
                    {result && (
                        <Card>
                            <CardHeader className="pb-0 pt-0">
                                <div className="flex border-b border-gray-200 dark:border-gray-700">
                                    {([
                                        { id: 'events' as const,    label: 'Logged Events',  Icon: Eye       },
                                        { id: 'breakdown' as const, label: 'Rule Breakdown', Icon: BarChart3 },
                                        { id: 'feed' as const,      label: 'Live Feed',      Icon: Activity  },
                                    ]).map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTab(t.id)}
                                            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 -mb-px transition-colors
                                                ${activeTab === t.id
                                                    ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                                                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            <t.Icon className="w-3.5 h-3.5" />
                                            {t.label}
                                        </button>
                                    ))}
                                    <div className="flex-1" />
                                    <button onClick={refreshFeed} title="Refresh"
                                        className="px-3 py-2 text-gray-400 hover:text-gray-600 transition-colors">
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4">

                                {activeTab === 'events' && (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
                                        {result.events_logged.map((ev, i) => {
                                            const flags = Object.entries(ev.flags ?? {}).filter(([, v]) => v > 0).map(([k]) => k)
                                            return (
                                                <div key={i} className="flex items-center gap-3 py-2">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: EVENT_DOT[ev.event_type] ?? '#94a3b8' }} />
                                                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">{ev.event_type}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono shrink-0 flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5" />{ev.delta_t_ms.toLocaleString()}ms
                                                    </span>
                                                    {flags.length > 0 && (
                                                        <div className="flex gap-1 shrink-0">
                                                            {flags.map(f => (
                                                                <span key={f} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                                                    {f.replace('_change', '').toUpperCase()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {activeTab === 'breakdown' && (
                                    <div className="space-y-3">
                                        {result.rule_breakdown
                                            .filter(r => r.contribution > 0)
                                            .sort((a, b) => b.contribution - a.contribution)
                                            .map(r => (
                                                <div key={r.feature} className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-600 dark:text-gray-300">
                                                            {FEATURE_LABEL[r.feature] ?? r.feature}
                                                            <span className="ml-1 text-gray-400">×{r.weight}</span>
                                                        </span>
                                                        <span className={`font-mono font-semibold ${r.contribution >= 1 ? 'text-red-600 dark:text-red-400' : r.contribution >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500'}`}>
                                                            +{r.contribution.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${r.contribution >= 1 ? 'bg-red-500' : r.contribution >= 0.5 ? 'bg-yellow-500' : 'bg-blue-400'}`}
                                                            style={{ width: `${Math.min((r.contribution / 13) * 100, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        {result.rule_breakdown.every(r => r.contribution === 0) && (
                                            <p className="text-center text-sm text-gray-400 py-4">No contributions — baseline session.</p>
                                        )}
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between text-xs">
                                            <span className="text-gray-500">Total</span>
                                            <span className="font-mono text-gray-700 dark:text-gray-300">
                                                {result.rule_breakdown.reduce((a, r) => a + r.contribution, 0).toFixed(2)} / {result.rule_weights_info.max_raw}
                                                <span className="ml-2 text-gray-400">= {result.scoring.rule_score.toFixed(3)}</span>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'feed' && (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
                                        {liveEvents.length === 0 ? (
                                            <p className="text-center text-sm text-gray-400 py-6">No events yet.</p>
                                        ) : liveEvents.map(ev => (
                                            <div key={ev.id} className="flex items-center gap-3 py-2">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: EVENT_DOT[ev.eventType] ?? '#94a3b8' }} />
                                                <span className="text-[10px] text-gray-400 font-mono shrink-0 w-16">
                                                    {new Date(ev.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                                <span className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">{ev.eventType}</span>
                                                {ev.flags && Object.values(ev.flags).some(v => v > 0) && (
                                                    <span className="text-[10px] text-red-500 font-semibold">⚠ flags</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </CardContent>
                        </Card>
                    )}

                    {/* Always-on feed when no result yet */}
                    {!result && liveEvents.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Session Event Feed
                                    <span className="text-xs font-normal text-gray-400">{liveEvents.length} recent</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-40 overflow-y-auto">
                                    {liveEvents.slice(0, 12).map(ev => (
                                        <div key={ev.id} className="flex items-center gap-3 py-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: EVENT_DOT[ev.eventType] ?? '#94a3b8' }} />
                                            <span className="text-[10px] text-gray-400 font-mono w-16">
                                                {new Date(ev.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{ev.eventType}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
