import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { type AuthSession, useAuthStore, type User } from '@/stores/auth'
import { api, getStatus } from './api'

const user: User = { id: 'u1', email: 'a@b.c', name: 'A', tenantId: 't1', role: 'Owner' }
const session = (accessToken: string): AuthSession => ({ accessToken, expiresAt: '', user })

// Fake server: only "Bearer fresh" is accepted, and /auth/refresh hands that token out.
let refreshCalls = 0
let refreshSucceeds = true
const seenAuthHeaders: (string | undefined)[] = []

function reply(config: InternalAxiosRequestConfig, status: number, data?: unknown) {
  const response = { data, status, statusText: '', headers: {}, config }
  if (status < 400) return response
  throw new AxiosError(`status ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response)
}

beforeEach(() => {
  refreshCalls = 0
  refreshSucceeds = true
  seenAuthHeaders.length = 0
  api.defaults.adapter = async (config) => {
    await Promise.resolve()
    if (config.url === '/auth/refresh') {
      refreshCalls++
      return refreshSucceeds ? reply(config, 200, session('fresh')) : reply(config, 401)
    }
    if (config.url === '/auth/login') return reply(config, 401)
    const header = config.headers.get('Authorization') as string | undefined
    seenAuthHeaders.push(header)
    return header === 'Bearer fresh' ? reply(config, 200, { ok: true }) : reply(config, 401)
  }
})

describe('api client', () => {
  it('sends the access token as a bearer header', async () => {
    useAuthStore.getState().setSession(session('fresh'))

    await api.get('/inventory')

    expect(seenAuthHeaders).toEqual(['Bearer fresh'])
  })

  it('refreshes once and replays every request that got a 401', async () => {
    useAuthStore.getState().setSession(session('expired'))

    const responses = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200])
    expect(refreshCalls).toBe(1)
    expect(useAuthStore.getState().accessToken).toBe('fresh')
  })

  it('ends the session and reports the original 401 when the refresh fails', async () => {
    useAuthStore.getState().setSession(session('expired'))
    refreshSucceeds = false

    const error: unknown = await api.get('/inventory').catch((e: unknown) => e)

    expect(getStatus(error)).toBe(401)
    expect((error as AxiosError).config?.url).toBe('/inventory')
    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('does not try to refresh when a login attempt is rejected', async () => {
    const error: unknown = await api
      .post('/auth/login', {}, { skipAuthRefresh: true })
      .catch((e: unknown) => e)

    expect(getStatus(error)).toBe(401)
    expect(refreshCalls).toBe(0)
  })
})
