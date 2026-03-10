import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  role: string
  address_street: string | null
  address_ward: string | null
  address_city: string | null
  address_country: string | null
  created_at: string | null
  updated_at: string | null
}

interface AuthState {
  isLoggedIn: boolean
  user: User | null
  sessionId: string | null
  expiresAt: string | null
  stepUpRequired: boolean
  stepUpReason: string | undefined
  login: (user: User, sessionId?: string, expiresAt?: string) => void
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  setStepUp: (required: boolean, reason?: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      user: null,
      sessionId: null,
      expiresAt: null,
      stepUpRequired: false,
      stepUpReason: undefined,

      login: (user, sessionId, expiresAt) =>
        set({ isLoggedIn: true, user, sessionId: sessionId ?? null, expiresAt: expiresAt ?? null }),

      setStepUp: (required, reason) =>
        set({ stepUpRequired: required, stepUpReason: reason }),

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch (e) {
          console.error('Logout API error:', e)
        }
        set({ isLoggedIn: false, user: null, sessionId: null, expiresAt: null })
      },

      refreshSession: async () => {
        try {
          const res = await fetch('/api/auth/refresh', { method: 'POST' })
          if (!res.ok) {
            // Session expired/invalid – force logout
            set({ isLoggedIn: false, user: null, sessionId: null, expiresAt: null })
            return
          }
          const data = await res.json()
          set({ sessionId: data.sessionId, expiresAt: data.expiresAt })
        } catch (e) {
          console.error('Session refresh error:', e)
        }
      },
    }),
    {
      name: 'auth-store',
      // Only persist user info, not sensitive session data
      partialize: (state) => ({ isLoggedIn: state.isLoggedIn, user: state.user }),
    }
  )
)
