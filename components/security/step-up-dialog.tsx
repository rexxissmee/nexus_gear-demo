'use client'
/**
 * StepUpDialog – Re-authentication dialog triggered by policy STEP_UP decision.
 *
 * Flow:
 *  1. Step-up requested → dialog opens (cannot be dismissed without auth)
 *  2. User enters password → POST /api/auth/step-up
 *  3. OK → dialog closes, session continues
 *  4. 3 failures → session is revoked, redirect to /auth
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth-store'

interface StepUpDialogProps {
    open: boolean
    reason?: string
    onSuccess: () => void    // dialog should close + session continues
    onRevoked: () => void    // 3 failures → caller should logout + redirect
}

const MAX_ATTEMPTS = 3

export function StepUpDialog({ open, reason, onSuccess, onRevoked }: StepUpDialogProps) {
    const user = useAuthStore(s => s.user)
    const router = useRouter()

    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [attempts, setAttempts] = useState(0)

    const attemptsLeft = MAX_ATTEMPTS - attempts

    const handleSubmit = async (e: React.FormEvent) => {
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

            // Failed
            const newAttempts = attempts + 1
            setAttempts(newAttempts)

            if (newAttempts >= MAX_ATTEMPTS) {
                setError('Too many failed attempts. Your session will be revoked.')
                setTimeout(() => {
                    onRevoked()
                }, 2000)
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
                // Prevent close on overlay click or Escape
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
                            : 'Suspicious activity was detected in your session. Please re-enter your password to continue.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={loading || !password || attempts >= MAX_ATTEMPTS}
                        >
                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {loading ? 'Verifying…' : 'Verify Identity'}
                        </Button>
                    </div>

                    <p className="text-xs text-center text-gray-500">
                        This security checkpoint protects your account from unauthorized access.
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    )
}
