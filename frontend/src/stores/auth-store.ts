import { create } from 'zustand'
import client from '@/api/client'

interface User {
  id: number
  email: string
  name: string
  is_admin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

const TOKEN_KEY = 'auth_token'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isAuthenticated: false,
  isLoading: !!localStorage.getItem(TOKEN_KEY),

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const response = await client.post<{ access_token: string }>(
        '/auth/login',
        { email, password },
      )
      const token = response.data.access_token
      localStorage.setItem(TOKEN_KEY, token)
      set({ token, isLoading: false })
      await useAuthStore.getState().fetchMe()
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true })
    try {
      await client.post('/auth/register', { email, password, name })
      set({ isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const response = await client.get<User>('/auth/me')
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },
}))
