import axios, { type AxiosError } from 'axios'
import { env } from '@/lib/env'
import { type AuthSession, useAuthStore } from '@/stores/auth'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set on calls whose 401 must not trigger a token refresh (login, refresh itself). */
    skipAuthRefresh?: boolean
    /** Internal: marks a request that was already replayed after a refresh. */
    _retried?: boolean
  }
}

export const api = axios.create({
  baseURL: env.apiUrl,
  // Sends the HttpOnly refresh-token cookie to /auth/*.
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

let refreshInFlight: Promise<void> | null = null

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request,
 * so a burst of 401s (or the startup check under StrictMode) refreshes only once.
 * On failure the session is cleared, which sends the user to the login page.
 */
export function refreshSession(): Promise<void> {
  refreshInFlight ??= api
    .post<AuthSession>('/auth/refresh', null, { skipAuthRefresh: true })
    .then(({ data }) => useAuthStore.getState().setSession(data))
    .catch((error: unknown) => {
      useAuthStore.getState().clearSession()
      throw error
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config
  const shouldRefresh =
    error.response?.status === 401 && config && !config.skipAuthRefresh && !config._retried
  if (!shouldRefresh) throw error

  config._retried = true
  try {
    await refreshSession()
  } catch {
    // The caller asked about its own request, so report that 401 rather than the refresh failure.
    throw error
  }
  return api(config)
})

/** Shape of RFC 7807 error bodies returned by the backend. */
export interface ProblemDetails {
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}

export function getProblem(error: unknown): ProblemDetails | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const data: unknown = error.response?.data
  return data && typeof data === 'object' ? (data as ProblemDetails) : undefined
}

export function getStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
