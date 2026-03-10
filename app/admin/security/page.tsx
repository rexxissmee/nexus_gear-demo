'use client'

import { useEffect, useState } from 'react'
import { Shield, AlertTriangle, Ban, ArrowUpCircle, Activity, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DashboardStats {
    totalSessions: number
    activeSessions: number
    revokedSessions: number
    warns: number
    stepUps: number
    revokes: number
    recentEvents: Array<{
        sessionId: string
        eventType: string
        deltaT_ms: number
        ts: string
    }>
}

export default function SecurityDashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch('/api/admin/security/report')
            .then(r => r.json())
            .then(data => {
                setStats(data)
                setLoading(false)
            })
            .catch(e => {
                setError('Failed to load stats')
                setLoading(false)
            })
    }, [])

    const handleExportCsv = () => {
        window.open('/api/admin/security/report?format=csv', '_blank')
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

    const fprEstimate = stats.totalSessions > 0
        ? ((stats.warns / stats.totalSessions) * 100).toFixed(1)
        : '0.0'

    const metricCards = [
        {
            title: 'Total Sessions',
            value: stats.totalSessions,
            icon: <Activity className="h-5 w-5 text-blue-400" />,
            color: 'text-blue-400',
        },
        {
            title: 'Active Sessions',
            value: stats.activeSessions,
            icon: <Shield className="h-5 w-5 text-green-400" />,
            color: 'text-green-400',
        },
        {
            title: 'Warnings',
            value: stats.warns,
            icon: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
            color: 'text-yellow-400',
        },
        {
            title: 'Step-Ups',
            value: stats.stepUps,
            icon: <ArrowUpCircle className="h-5 w-5 text-orange-400" />,
            color: 'text-orange-400',
        },
        {
            title: 'Revokes',
            value: stats.revokes,
            icon: <Ban className="h-5 w-5 text-red-400" />,
            color: 'text-red-400',
        },
        {
            title: 'Est. FPR %',
            value: `${fprEstimate}%`,
            icon: <Activity className="h-5 w-5 text-purple-400" />,
            color: 'text-purple-400',
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
        SESSION_ANOMALY_WARN: 'bg-red-800 text-red-200',
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
                        Session Hijacking Detection – LSTM Next-Event Prediction MVP
                    </p>
                </div>
                <Button variant="outline" onClick={handleExportCsv} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Metric Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Session</th>
                                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Event</th>
                                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Δt (ms)</th>
                                        <th className="text-left py-2 font-medium text-muted-foreground">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentEvents.map((event, i) => (
                                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                                            <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                                                {event.sessionId.slice(0, 16)}…
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
        </div>
    )
}
