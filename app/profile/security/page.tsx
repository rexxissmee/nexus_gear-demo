'use client'

import { useEffect, useState } from 'react'
import { Shield, LogOut, MonitorSmartphone, Clock, Check, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth-store'
import { toast } from 'sonner'

interface Session {
    sessionId: string
    rotationEnabled: boolean
    ipBucket: string | null
    uaBucket: string | null
    createdAt: string
    expiresAt: string
    isCurrent: boolean
}

export default function SecuritySettingsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [revoking, setRevoking] = useState<string | null>(null)
    const { logout } = useAuthStore()

    const fetchSessions = async () => {
        try {
            const res = await fetch('/api/security/sessions')
            if (!res.ok) throw new Error('Failed to fetch sessions')
            const data = await res.json()
            setSessions(data.sessions ?? [])
        } catch (e) {
            toast.error('Could not load sessions')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchSessions() }, [])

    const handleRevoke = async (sessionId: string, isCurrent: boolean) => {
        setRevoking(sessionId)
        try {
            const res = await fetch('/api/security/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            })
            if (!res.ok) throw new Error()
            toast.success('Session revoked')
            if (isCurrent) {
                await logout()
                window.location.href = '/auth'
            } else {
                await fetchSessions()
            }
        } catch {
            toast.error('Failed to revoke session')
        } finally {
            setRevoking(null)
        }
    }

    const handleRevokeAll = async () => {
        const others = sessions.filter(s => !s.isCurrent)
        for (const s of others) {
            await fetch('/api/security/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: s.sessionId }),
            })
        }
        toast.success(`Revoked ${others.length} other session(s)`)
        await fetchSessions()
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Session Security
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                    Manage your active sessions. Revoke any session you don&apos;t recognize.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-base">Active Sessions</CardTitle>
                        <CardDescription>{sessions.length} session(s) found</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={fetchSessions}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        {sessions.filter(s => !s.isCurrent).length > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleRevokeAll}>
                                Revoke Others
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">No active sessions found.</p>
                    ) : (
                        sessions.map(session => (
                            <div
                                key={session.sessionId}
                                className={`flex items-start justify-between p-4 rounded-lg border ${session.isCurrent ? 'border-primary/40 bg-primary/5' : 'border-border/50'}`}
                            >
                                <div className="flex gap-3">
                                    <MonitorSmartphone className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {session.sessionId.slice(0, 20)}…
                                            </span>
                                            {session.isCurrent && (
                                                <Badge variant="outline" className="text-green-400 border-green-400/50 text-xs">
                                                    <Check className="h-3 w-3 mr-1" />Current
                                                </Badge>
                                            )}
                                            {session.rotationEnabled && (
                                                <Badge variant="secondary" className="text-xs">Token Rotation ON</Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Browser: {session.uaBucket ?? 'unknown'} &nbsp;|&nbsp; IP subnet: {session.ipBucket ?? 'unknown'}
                                        </p>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            Created {new Date(session.createdAt).toLocaleString()}
                                            &nbsp;·&nbsp;
                                            Expires {new Date(session.expiresAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-950 shrink-0"
                                    disabled={revoking === session.sessionId}
                                    onClick={() => handleRevoke(session.sessionId, session.isCurrent)}
                                >
                                    <LogOut className="h-4 w-4 mr-1" />
                                    {session.isCurrent ? 'Logout' : 'Revoke'}
                                </Button>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
