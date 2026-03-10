"use client"
import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { ThemeProvider } from "@/components/theme-provider"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/toaster"
import { useAuthStore } from "@/store/auth-store"
import { useSecurityMonitor, type ScoreResult } from "@/hooks/use-security-monitor"
import { StepUpDialog } from "@/components/security/step-up-dialog"
import { useToast } from "@/hooks/use-toast"

// ── Session Guard ──────────────────────────────────────────────────────────────
// Polls /api/auth/check every 5s to detect remote session revocation.
// If the server returns 401 (session revoked/expired), force logout immediately.
const SESSION_CHECK_INTERVAL_MS = 5_000

function SessionGuard() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const logout = useAuthStore(s => s.logout)
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/check', { method: 'GET', cache: 'no-store' })
      if (res.status === 401) {
        // Session was revoked remotely — clear state and redirect
        await logout()
        router.replace('/auth?reason=session_revoked')
      }
    } catch {
      // Network error – don't force logout, let the user retry
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return

    // Check immediately on login, then every 5s
    checkSession()
    intervalRef.current = setInterval(checkSession, SESSION_CHECK_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  return null
}

// ── Security Monitor ───────────────────────────────────────────────────────────
// Detects anomalous client behavior (idle, burst, navigation) and scores via LSTM.
// Reacts to policy decisions: WARN (toast), STEP_UP (dialog), REVOKE (force logout).
function SecurityMonitor() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const logout = useAuthStore(s => s.logout)
  const stepUpRequired = useAuthStore(s => s.stepUpRequired)
  const stepUpReason = useAuthStore(s => s.stepUpReason)
  const setStepUp = useAuthStore(s => s.setStepUp)
  const router = useRouter()
  const { toast } = useToast()

  const handleDecision = (result: ScoreResult) => {
    if (result.decision === 'WARN') {
      toast({
        title: 'Unusual activity detected',
        description: result.reason ?? 'Your session behaviour looks unusual.',
        variant: 'destructive',
        duration: 6000,
      })
    } else if (result.decision === 'STEP_UP') {
      setStepUp(true, result.reason)
    } else if (result.decision === 'REVOKE') {
      logout().then(() => router.replace('/auth?reason=session_revoked'))
    }
  }

  useSecurityMonitor({ enabled: isLoggedIn, onDecision: handleDecision })

  const handleStepUpSuccess = () => setStepUp(false)

  const handleStepUpRevoked = async () => {
    setStepUp(false)
    await logout()
    router.replace('/auth?reason=step_up_failed')
  }

  return (
    <StepUpDialog
      open={stepUpRequired && isLoggedIn}
      reason={stepUpReason}
      onSuccess={handleStepUpSuccess}
      onRevoked={handleStepUpRevoked}
    />
  )
}


function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [pathname])

  return null
}

function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)
    return () => window.removeEventListener("scroll", toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  if (!isVisible) {
    return null
  }

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full gradient-btn-light dark:gradient-btn-dark text-white shadow-lg transition-all duration-300 hover:scale-110"
      size="icon"
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </Button>
  )
}

const inter = Inter({ subsets: ["latin"] })

export default function ClientLayout({
  children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin")
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
          storageKey="nexusgear-theme"
        >
          <SessionGuard />
          <SecurityMonitor />
          {!isAdmin && <ScrollToTop />}
          {!isAdmin && <Navbar />}
          {children}
          {!isAdmin && <Footer />}
          {!isAdmin && <BackToTopButton />}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
