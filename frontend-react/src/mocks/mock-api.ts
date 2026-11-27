import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { type AuthSession, ROLES, type Role, type User } from '@/stores/auth'

// Dev-only stand-in for the /auth endpoints of docs/API_REFERENCE.md §2, used until the backend
// implements them. Every other request falls through to the real network (Vite proxy).
// Enabled by VITE_USE_MOCKS=true; never loaded in production builds.

interface MockResult {
  status: number
  data?: unknown
}

type Handler = (config: InternalAxiosRequestConfig) => MockResult

// Stands in for the HttpOnly refresh cookie: survives reloads, cleared when the tab closes.
const SESSION_KEY = 'senic.mock.session'

function readUser(): User | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as User) : null
}

function session(user: User): AuthSession {
  return {
    accessToken: `mock.${user.id}.${Date.now()}`,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    user,
  }
}

/** admin@…, cashier@…, viewer@… sign in with that role; anything else is an Owner. */
function roleFromEmail(email: string): Role {
  const prefix = email.split('@')[0].toLowerCase()
  return ROLES.find((role) => role.toLowerCase() === prefix) ?? 'Owner'
}

const unauthorized: MockResult = {
  status: 401,
  data: { title: 'Unauthorized', status: 401 },
}

const handlers: Record<string, Handler> = {
  'POST /auth/login': (config) => {
    const { tenantId, email, password } = JSON.parse(String(config.data)) as Record<string, string>
    if (!tenantId || !email || !password || password.length < 6) return unauthorized
    const user: User = {
      id: crypto.randomUUID(),
      email,
      name: email.split('@')[0],
      tenantId,
      role: roleFromEmail(email),
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    return { status: 200, data: session(user) }
  },

  'POST /auth/refresh': () => {
    const user = readUser()
    return user ? { status: 200, data: session(user) } : unauthorized
  },

  'POST /auth/logout': () => {
    sessionStorage.removeItem(SESSION_KEY)
    return { status: 204 }
  },

  'GET /auth/me': () => {
    const user = readUser()
    return user ? { status: 200, data: user } : unauthorized
  },
}

export function installMockApi(api: AxiosInstance) {
  const network = axios.getAdapter(api.defaults.adapter)

  api.defaults.adapter = async (config) => {
    const handler = handlers[`${config.method?.toUpperCase()} ${config.url}`]
    if (!handler) return network(config)

    await new Promise((resolve) => setTimeout(resolve, 300))
    const { status, data } = handler(config)
    const response = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      )
    }
    return response
  }

  console.info('[mock-api] /auth/* is mocked (VITE_USE_MOCKS=true)')
}
