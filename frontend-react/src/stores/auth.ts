import { create } from 'zustand'

export const ROLES = ['Admin', 'Owner', 'Cashier', 'Viewer'] as const
export type Role = (typeof ROLES)[number]

export interface User {
  id: string
  email: string
  name: string
  tenantId: string
  role: Role
}

/** Response of POST /auth/login and POST /auth/refresh (docs/API_REFERENCE.md §2). */
export interface AuthSession {
  accessToken: string
  expiresAt: string
  user: User
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  /** 'loading' until the first refresh attempt on startup settles. */
  status: AuthStatus
  user: User | null
  /** Kept in memory only; the refresh token lives in an HttpOnly cookie. */
  accessToken: string | null
  setSession: (session: AuthSession) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  setSession: ({ accessToken, user }) => set({ status: 'authenticated', accessToken, user }),
  clearSession: () => set({ status: 'anonymous', accessToken: null, user: null }),
}))

/** No `roles` means the resource is open to every signed-in user. */
export function hasAnyRole(user: User | null, roles?: readonly Role[]): boolean {
  if (!user) return false
  return !roles || roles.length === 0 || roles.includes(user.role)
}
