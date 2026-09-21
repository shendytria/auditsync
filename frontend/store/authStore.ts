'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: number
  fullName: string
  role: string
  username: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  isDefaultPassword: boolean
  login: (user: User, token: string, isDefaultPassword: boolean) => void
  logout: () => void
  updatePasswordStatus: () => void
}

export const useAuthStore = create<AuthState>()(
  persist<AuthState>(
    (set) => ({
      user: null,
      token: null,
      isDefaultPassword: false,

      login: (user: User, token: string, isDefaultPassword: boolean) => {
        set({ user, token, isDefaultPassword })
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isDefaultPassword: false,
        })
      },

      updatePasswordStatus: () => {
        set({ isDefaultPassword: false })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
