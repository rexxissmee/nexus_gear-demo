'use client'
/**
 * StepUpDialog – Re-authentication dialog triggered by policy STEP_UP decision.
 *
 * Flow (Passkey-first):
 *  1. Dialog mở → tự động thử Passkey step-up (nếu user có passkey)
 *  2. Passkey thành công → dialog đóng
 *  3. Passkey thất bại / không có → hiện form password
 *  4. 3 lần sai password → revoke session
 */
import { useState, useEffect } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import { ShieldAlert, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth-store'

interface StepUpDialogProps {
    open: boolean
    reason?: string
    onSuccess: () => void
    onRevoked: () => void
}

const MAX_ATTEMPTS = 3

export function StepUpDialog({ open, reason, onSuccess, onRevoked }: StepUpDialogProps) {
    const user = useAuthStore(s => s.user)

    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [passkeyLoading, setPasskeyLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [attempts, setAttempts] = useState(0)
    const [hasPasskey, setHasPasskey] = useState<boolean | null>(null) // null = loading
    const [showPasswordFallback, setShowPasswordFallback] = useState(false)

    const attemptsLeft = MAX_ATTEMPTS - attempts

    // Khi dialog mở: kiểm tra user có passkey không, nếu có thì tự trigger ngay
    useEffect(() => {
        if (!open) {
            // Reset khi đóng
            setPassword('')
            setError(null)
            setAttempts(0)
            setShowPasswordFallback(false)
            setHasPasskey(null)
            return
        }
        checkAndTriggerPasskey()
    }, [open])

    // Kiểm tra passkey và tự trigger step-up nếu có
    const checkAndTriggerPasskey = async () => {
        try {
            const res = await fetch('/api/auth/passkey/list')
            const data = await res.json()
            const count = data.passkeys?.length ?? 0
            setHasPasskey(count > 0)
            if (count > 0) {
                // Auto-trigger passkey step-up
                await handlePasskeyStepUp()
            } else {
                setShowPasswordFallback(true)
            }
        } catch {
            setHasPasskey(false)
            setShowPasswordFallback(true)
        }
    }

    const handlePasskeyStepUp = async () => {
        setPasskeyLoading(true)
        setError(null)
        try {
            // 1. Get options
            const optRes = await fetch('/api/auth/passkey/step-up')
            if (!optRes.ok) {
                setShowPasswordFallback(true)
                return
            }
            const options = await optRes.json()

            // 2. Trigger browser passkey dialog
            const credential = await startAuthentication({ optionsJSON: options })

            // 3. Verify
            const verifyRes = await fetch('/api/auth/passkey/step-up', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credential),
            })

            if (verifyRes.ok) {
                onSuccess()
            } else {
                setError('Passkey verification failed. Try your password instead.')
                setShowPasswordFallback(true)
            }
        } catch (err: unknown) {
            // User cancelled passkey dialog → show password fallback
            const name = err instanceof Error ? err.name : ''
            if (name !== 'NotAllowedError') {
                setError('Passkey error. Please use your password.')
            }
            setShowPasswordFallback(true)
        } finally {
            setPasskeyLoading(false)
        }
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!password) return
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/step-up', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setPassword('')
                setAttempts(0)
                onSuccess()
                return
            }

            const newAttempts = attempts + 1
            setAttempts(newAttempts)

            if (newAttempts >= MAX_ATTEMPTS) {
                setError('Too many failed attempts. Your session will be revoked.')
                setTimeout(() => onRevoked(), 2000)
                return
            }

            setError(data.error ?? 'Incorrect password')
            setPassword('')
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent
                className="sm:max-w-md"
                onEscapeKeyDown={e => e.preventDefault()}
                onInteractOutside={e => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-xl">Security Verification Required</DialogTitle>
                    <DialogDescription className="text-center">
                        {reason
                            ? `Unusual activity detected: ${reason}`
                            : 'Suspicious activity detected. Please verify your identity to continue.'}
                    </DialogDescription>
                </DialogHeader>

                {/* Passkey loading state */}
                {passkeyLoading && (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-sm text-center text-gray-600 dark:text-gray-300">
                            Waiting for passkey verification…
                        </p>
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    </div>
                )}

                {/* Passkey button (khi đã thấy có passkey nhưng không auto-trigger) */}
                {!passkeyLoading && hasPasskey && showPasswordFallback && (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center gap-2 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={handlePasskeyStepUp}
                        disabled={loading}
                    >
                        <KeyRound className="h-4 w-4 text-blue-600" />
                        Use Passkey Instead
                    </Button>
                )}

                {/* Password fallback form */}
                {!passkeyLoading && showPasswordFallback && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4 mt-2">
                        <div className="space-y-1">
                            <Label htmlFor="step-up-email">Email</Label>
                            <Input
                                id="step-up-email"
                                value={user?.email ?? ''}
                                disabled
                                className="bg-gray-50 dark:bg-gray-800"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="step-up-password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="step-up-password"
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    disabled={loading || attempts >= MAX_ATTEMPTS}
                                    autoFocus
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPass(v => !v)}
                                    tabIndex={-1}
                                >
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                        )}

                        {attempts > 0 && attempts < MAX_ATTEMPTS && (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                                {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
                            </p>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={loading || !password || attempts >= MAX_ATTEMPTS}
                        >
                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {loading ? 'Verifying…' : 'Verify Identity'}
                        </Button>

                        <p className="text-xs text-center text-gray-500">
                            This security checkpoint protects your account from unauthorized access.
                        </p>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
