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
  /**
   * Kept in memory only; the refresh token lives in an HttpOnly cookie.
   * Null while authenticated means an offline session (see `resumeOffline`).
   */
  accessToken: string | null
  /** When the access token expires, in ms since the epoch; null when unknown or absent. */
  accessTokenExpiresAt: number | null
  setSession: (session: AuthSession) => void
  clearSession: () => void
  /**
   * Called when the server cannot be reached at startup. Restores the last signed-in user
   * (profile only, no token) so the till keeps working through an outage: the local catalog
   * and the offline order queue need to know whose data to use. Nothing can be read from or
   * written to the server until a real refresh succeeds. Returns false if nobody was signed in.
   */
  resumeOffline: () => boolean
}

// The profile is not a secret (no token), so localStorage is fine. It is removed on sign-out
// and whenever the server rejects the refresh token.
const USER_KEY = 'senic.user'

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  setSession: ({ accessToken, expiresAt, user }) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({
      status: 'authenticated',
      accessToken,
      accessTokenExpiresAt: Date.parse(expiresAt) || null,
      user,
    })
  },
  clearSession: () => {
    localStorage.removeItem(USER_KEY)
    set({ status: 'anonymous', accessToken: null, accessTokenExpiresAt: null, user: null })
  },
  resumeOffline: () => {
    const user = readStoredUser()
    if (!user) return false
    set({ status: 'authenticated', accessToken: null, accessTokenExpiresAt: null, user })
    return true
  },
}))

/** No `roles` means the resource is open to every signed-in user. */
export function hasAnyRole(user: User | null, roles?: readonly Role[]): boolean {
  if (!user) return false
  return !roles || roles.length === 0 || roles.includes(user.role)
}
