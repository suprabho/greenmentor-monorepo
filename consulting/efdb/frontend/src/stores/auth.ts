import { create } from 'zustand'
import type { User } from '@/types/emission-factor'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('efdb_token'),
  user: (() => {
    try {
      const u = localStorage.getItem('efdb_user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })(),
  setAuth: (token, user) => {
    localStorage.setItem('efdb_token', token)
    localStorage.setItem('efdb_user', JSON.stringify(user))
    set({ token, user })
  },
  logout: () => {
    localStorage.removeItem('efdb_token')
    localStorage.removeItem('efdb_user')
    set({ token: null, user: null })
  },
  isAdmin: () => get().user?.role === 'admin',
}))
