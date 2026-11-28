import axios, { type AxiosError } from 'axios'
import i18n from '@/i18n'
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

/**
 * True when the request never got an answer from the API: no connection, a timeout, or a
 * gateway in front of it (the dev proxy, a load balancer) reporting that the API is down.
 * These are the failures worth retrying later; an answer such as 400 or 409 is not.
 */
export function isNetworkError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (!error.response) return true
  return [502, 503, 504].includes(error.response.status)
}

let refreshInFlight: Promise<void> | null = null

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request,
 * so a burst of 401s (or the startup check under StrictMode) refreshes only once.
 *
 * If the server rejects the cookie, the session is cleared, which sends the user to the login
 * page. If the server cannot be reached, a signed-in user stays signed in (the outage is not
 * their fault), and at startup the last user is restored as an offline session.
 */
export function refreshSession(): Promise<void> {
  refreshInFlight ??= api
    .post<AuthSession>('/auth/refresh', null, { skipAuthRefresh: true })
    .then(({ data }) => useAuthStore.getState().setSession(data))
    .catch((error: unknown) => {
      const auth = useAuthStore.getState()
      if (!isNetworkError(error)) {
        auth.clearSession()
      } else if (auth.status === 'loading' && !auth.resumeOffline()) {
        auth.clearSession()
      }
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
  } catch (refreshError) {
    // Could not reach the server to refresh: report that, so callers treat it as an outage.
    if (isNetworkError(refreshError)) throw refreshError
    // The caller asked about its own request, so report that 401 rather than the refresh failure.
    throw error
  }
  return api(config)
})

/** Shape of RFC 7807 error bodies returned by the backend. */
export interface ProblemDetails {
  title?: string
  status?: number
  /** English, for logs and for clients that do not know `code`. */
  detail?: string
  errors?: Record<string, string[]>
  /** The stable name of the error (backend ErrorCodes); translated in the "errors" section of the locale files. */
  code?: string
  /** The values the sentence for `code` needs, e.g. the name of the item that ran out. */
  params?: Record<string, string | number | null>
}

export function getProblem(error: unknown): ProblemDetails | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const data: unknown = error.response?.data
  return data && typeof data === 'object' ? (data as ProblemDetails) : undefined
}

/**
 * What to tell the user about a failed request, in their language: the sentence for the
 * server's error code when it sent one we know, otherwise `fallback`. The server's own
 * explanation is English, so it is shown only to someone reading English.
 */
export function errorMessage(error: unknown, fallback: string): string {
  const problem = getProblem(error)
  if (problem?.code) {
    const key = `errors.${problem.code}`
    // The key comes from the server, so it is outside the keys the compiler knows.
    if (i18n.exists(key)) return String(i18n.t(key as never, (problem.params ?? {}) as never))
  }
  return (i18n.language === 'en' && (problem?.detail || problem?.title)) || fallback
}

/**
 * The sentence for a server error code in the current language, or null when the code is
 * unknown. For errors that are kept and shown later (a bill refused while syncing).
 */
export function messageForCode(
  code: string | undefined,
  params?: ProblemDetails['params'],
): string | null {
  if (!code) return null
  const key = `errors.${code}`
  return i18n.exists(key) ? String(i18n.t(key as never, (params ?? {}) as never)) : null
}

export function getStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
