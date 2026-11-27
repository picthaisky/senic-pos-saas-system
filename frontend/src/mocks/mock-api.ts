import axios, { AxiosError, type AxiosInstance } from 'axios'
import { type AuthSession, ROLES, type Role, type User } from '@/stores/auth'
import { dataRoutes } from './mock-data'

// Dev-only stand-in for the endpoints of docs/API_REFERENCE.md, used until the backend
// implements the contract. Requests that match no route fall through to the real network
// (Vite proxy). Enabled by VITE_USE_MOCKS=true; never loaded in production builds.

export interface MockResult {
  status: number
  data?: unknown
}

export interface MockRequest {
  /** Values of `:name` segments in the route pattern. */
  params: Record<string, string>
  query: Record<string, unknown>
  body: unknown
}

export type MockRoute = [method: string, pattern: string, handler: (req: MockRequest) => MockResult]

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

// What the mock user signed in with; unknown (anything is accepted) after a page reload.
let mockPassword: string | null = null

const unauthorized: MockResult = { status: 401, data: { title: 'Unauthorized', status: 401 } }

const authRoutes: MockRoute[] = [
  [
    'POST',
    '/auth/login',
    ({ body }) => {
      const { tenantId, email, password } = body as Record<string, string>
      if (!tenantId || !email || !password || password.length < 6) return unauthorized
      const user: User = {
        id: crypto.randomUUID(),
        email,
        name: email.split('@')[0],
        tenantId,
        role: roleFromEmail(email),
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      mockPassword = password
      return { status: 200, data: session(user) }
    },
  ],
  [
    'POST',
    '/auth/refresh',
    () => {
      const user = readUser()
      return user ? { status: 200, data: session(user) } : unauthorized
    },
  ],
  [
    'POST',
    '/auth/logout',
    () => {
      sessionStorage.removeItem(SESSION_KEY)
      return { status: 204 }
    },
  ],
  [
    'POST',
    '/auth/change-password',
    ({ body }) => {
      const { currentPassword, newPassword } = body as Record<string, string>
      if (mockPassword !== null && currentPassword !== mockPassword) {
        return {
          status: 400,
          data: {
            title: 'One or more validation errors occurred.',
            status: 400,
            errors: { CurrentPassword: ['The current password is incorrect.'] },
          },
        }
      }
      mockPassword = newPassword
      return { status: 204 }
    },
  ],
  [
    'GET',
    '/auth/me',
    () => {
      const user = readUser()
      return user ? { status: 200, data: user } : unauthorized
    },
  ],
]

const routes = [...authRoutes, ...dataRoutes]

/** Matches `/customers/:id/loyalty` against a path; returns the `:name` values or null. */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/')
  const pathParts = path.split('/')
  if (patternParts.length !== pathParts.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

export function installMockApi(api: AxiosInstance, options: { delayMs?: number } = {}) {
  const network = axios.getAdapter(api.defaults.adapter)
  const delayMs = options.delayMs ?? 300

  api.defaults.adapter = async (config) => {
    const method = config.method?.toUpperCase()
    let params: Record<string, string> | null = null
    const route = routes.find(
      ([routeMethod, pattern]) =>
        routeMethod === method && (params = matchPath(pattern, config.url ?? '')) !== null,
    )
    if (!route || !params) return network(config)

    // A real server is unreachable while the browser is offline; so is the mock.
    if (!navigator.onLine) {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
    const { status, data } = route[2]({
      params,
      query: (config.params ?? {}) as Record<string, unknown>,
      body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    })
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

  console.info('[mock-api] API is mocked in the browser (VITE_USE_MOCKS=true)')
}
