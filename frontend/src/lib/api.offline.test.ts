import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { type AuthSession, useAuthStore, type User } from '@/stores/auth'
import { api, isNetworkError, refreshSession } from './api'

// What happens to the session when the server cannot be reached (as opposed to the server
// rejecting it).

const user: User = { id: 'u1', email: 'a@b.c', name: 'A', tenantId: 't1', role: 'Cashier' }
const session: AuthSession = { accessToken: 'token', expiresAt: '', user }

type ServerState = 'up' | 'unreachable' | 'gateway-down' | 'rejects-refresh'
let server: ServerState = 'up'

function fail(config: InternalAxiosRequestConfig, status?: number): never {
  const response = status
    ? { data: undefined, status, statusText: '', headers: {}, config }
    : undefined
  throw new AxiosError(
    'failed',
    status ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_NETWORK,
    config,
    null,
    response,
  )
}

beforeEach(() => {
  server = 'up'
  localStorage.clear()
  useAuthStore.setState({ status: 'loading', user: null, accessToken: null })
  api.defaults.adapter = async (config) => {
    await Promise.resolve()
    if (server === 'unreachable') fail(config)
    if (server === 'gateway-down') fail(config, 502)
    if (config.url === '/auth/refresh') {
      if (server === 'rejects-refresh') fail(config, 401)
      return { data: session, status: 200, statusText: '', headers: {}, config }
    }
    // Any other endpoint: the access token has expired.
    fail(config, 401)
  }
})

describe('session when the server is unreachable', () => {
  it('keeps a signed-in user signed in', async () => {
    useAuthStore.getState().setSession(session)
    server = 'unreachable'

    const error: unknown = await api.get('/inventory').catch((e: unknown) => e)

    expect(isNetworkError(error)).toBe(true)
    expect(useAuthStore.getState().status).toBe('authenticated')
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('treats a gateway error from the dev proxy or load balancer the same way', async () => {
    useAuthStore.getState().setSession(session)
    server = 'gateway-down'

    const error: unknown = await api.get('/inventory').catch((e: unknown) => e)

    expect(isNetworkError(error)).toBe(true)
    expect(useAuthStore.getState().status).toBe('authenticated')
  })

  it('at startup, restores the last user without a token', async () => {
    useAuthStore.getState().setSession(session) // an earlier visit
    useAuthStore.setState({ status: 'loading', user: null, accessToken: null }) // page reload
    server = 'unreachable'

    await refreshSession().catch(() => {})

    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      user,
      accessToken: null,
    })
  })

  it('at startup, sends a device nobody signed in on to the login page', async () => {
    server = 'unreachable'

    await refreshSession().catch(() => {})

    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it('gets a real token again once the server is back', async () => {
    useAuthStore.getState().setSession(session)
    useAuthStore.setState({ status: 'loading', user: null, accessToken: null })
    server = 'unreachable'
    await refreshSession().catch(() => {})

    server = 'up'
    await refreshSession()

    expect(useAuthStore.getState().accessToken).toBe('token')
  })
})

describe('session when the server rejects the refresh token', () => {
  it('signs the user out and forgets the stored profile', async () => {
    useAuthStore.getState().setSession(session)
    server = 'rejects-refresh'

    await api.get('/inventory').catch(() => {})

    expect(useAuthStore.getState().status).toBe('anonymous')
    // A later outage must not resurrect the session.
    expect(useAuthStore.getState().resumeOffline()).toBe(false)
  })
})
