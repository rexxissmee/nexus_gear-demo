'use client'

import { useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { Shield, LogOut, MonitorSmartphone, Clock, Check, RefreshCw, KeyRound, Plus, Trash2, Lock, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface Passkey {
    id: number
    name: string | null
    createdAt: string
    transports: string | null
}

export default function SecuritySettingsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [revoking, setRevoking] = useState<string | null>(null)
    const [passkeys, setPasskeys] = useState<Passkey[]>([])
    const [passkeyLoading, setPasskeyLoading] = useState(false)
    const [addingPasskey, setAddingPasskey] = useState(false)
    // Change password state
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
    const [pwLoading, setPwLoading] = useState(false)
    const [pwError, setPwError] = useState<string | null>(null)
    const [pwSuccess, setPwSuccess] = useState<string | null>(null)
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNext, setShowNext] = useState(false)
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

    const fetchPasskeys = async () => {
        try {
            const res = await fetch('/api/auth/passkey/list')
            if (!res.ok) return
            const data = await res.json()
            setPasskeys(data.passkeys ?? [])
        } catch { /* non-fatal */ }
    }

    const handleAddPasskey = async () => {
        setAddingPasskey(true)
        try {
            // 1. Get registration options
            const optRes = await fetch('/api/auth/passkey/register/options')
            if (!optRes.ok) throw new Error('Failed to get options')
            const options = await optRes.json()

            // 2. Browser passkey dialog
            const credential = await startRegistration({ optionsJSON: options })

            // 3. Verify & save
            const verifyRes = await fetch('/api/auth/passkey/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            })

            if (!verifyRes.ok) throw new Error('Verification failed')
            toast.success('Passkey added successfully!')
            await fetchPasskeys()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : ''
            if (!msg.includes('NotAllowedError')) {
                toast.error('Failed to add passkey')
            }
        } finally {
            setAddingPasskey(false)
        }
    }

    const handleDeletePasskey = async (id: number) => {
        setPasskeyLoading(true)
        try {
            const res = await fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            toast.success('Passkey removed')
            await fetchPasskeys()
        } catch {
            toast.error('Failed to remove passkey')
        } finally {
            setPasskeyLoading(false)
        }
    }


    useEffect(() => { fetchSessions(); fetchPasskeys() }, [])

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

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setPwError(null)
        setPwSuccess(null)

        if (pwForm.next !== pwForm.confirm) {
            setPwError('New passwords do not match')
            return
        }
        if (pwForm.next.length < 8) {
            setPwError('New password must be at least 8 characters')
            return
        }

        setPwLoading(true)
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
            })
            const data = await res.json()
            if (!res.ok) {
                setPwError(data.error || 'Failed to change password')
                return
            }
            setPwForm({ current: '', next: '', confirm: '' })
            setPwSuccess('Password changed successfully!')
            toast.success('Password changed!')
        } catch {
            setPwError('Network error. Please try again.')
        } finally {
            setPwLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Session Security
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                    Manage your active sessions and passkeys.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Lệnh trái */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6 w-full">
                    {/* ===== PASSKEYS SECTION ===== */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-blue-500" />
                            Passkeys
                        </CardTitle>
                        <CardDescription>Sign in faster with biometrics. No password needed.</CardDescription>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddPasskey}
                        disabled={addingPasskey}
                        className="flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" />
                        {addingPasskey ? 'Adding…' : 'Add Passkey'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {passkeys.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No passkeys registered. Add one for passwordless sign-in.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {passkeys.map(pk => (
                                <div key={pk.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                                    <div className="flex items-center gap-3">
                                        <KeyRound className="h-4 w-4 text-blue-400 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium">{pk.name ?? 'Passkey'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Added {new Date(pk.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-400 hover:text-red-300 hover:bg-red-950"
                                        disabled={passkeyLoading}
                                        onClick={() => handleDeletePasskey(pk.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            {/* ===== ACTIVE SESSIONS SECTION ===== */}
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

                {/* Cột phải */}
                <div className="lg:col-span-5 xl:col-span-4 w-full">
            {/* ===== CHANGE PASSWORD SECTION ===== */}
            <Card className="sticky top-6">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="h-4 w-4 text-orange-500" />
                        Change Password
                    </CardTitle>
                    <CardDescription>Update your password. You'll need your current password to confirm.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="flex flex-col gap-4">
                            {/* Current password */}
                            <div className="space-y-1.5 flex-1">
                                <Label htmlFor="current-password">Current Password</Label>
                                <div className="relative">
                                    <Input
                                        id="current-password"
                                        type={showCurrent ? 'text' : 'password'}
                                        placeholder="Enter current password"
                                        value={pwForm.current}
                                        onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                                        disabled={pwLoading}
                                        required
                                        className="pr-10 [&::-ms-reveal]:hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        tabIndex={-1}
                                        className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
                                        onClick={() => setShowCurrent(v => !v)}
                                    >
                                        {showCurrent ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                </div>
                            </div>

                            {/* New password */}
                            <div className="space-y-1.5 flex-1">
                                <Label htmlFor="new-password">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="new-password"
                                        type={showNext ? 'text' : 'password'}
                                        placeholder="Min. 8 characters"
                                        value={pwForm.next}
                                        onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                                        disabled={pwLoading}
                                        required
                                        className="pr-10 [&::-ms-reveal]:hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        tabIndex={-1}
                                        className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
                                        onClick={() => setShowNext(v => !v)}
                                    >
                                        {showNext ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Confirm new password */}
                            <div className="space-y-1.5 flex-1">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    placeholder="Re-enter new password"
                                    value={pwForm.confirm}
                                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                                    disabled={pwLoading}
                                    required
                                    className="[&::-ms-reveal]:hidden"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            {pwError && (
                                <p className="text-sm text-red-500 font-medium">{pwError}</p>
                            )}
                            {pwSuccess && (
                                <p className="text-sm text-green-500 font-medium">{pwSuccess}</p>
                            )}
                            <Button
                                type="submit"
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                                disabled={pwLoading || !pwForm.current || !pwForm.next || !pwForm.confirm}
                            >
                                {pwLoading ? 'Updating…' : 'Update Password'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
                </div>
            </div>
        </div>
    )
}
