import { create } from 'zustand'

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
  login: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  login: (user) => set({ isLoggedIn: true, user }),
  logout: () => set({ isLoggedIn: false, user: null }),
}))
