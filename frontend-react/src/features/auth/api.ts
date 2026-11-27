import { api } from '@/lib/api'
import type { AuthSession } from '@/stores/auth'

export interface LoginRequest {
  tenantId: string
  email: string
  password: string
}

export const authApi = {
  login: (request: LoginRequest) =>
    api
      .post<AuthSession>('/auth/login', request, { skipAuthRefresh: true })
      .then((response) => response.data),

  logout: () => api.post<void>('/auth/logout', null, { skipAuthRefresh: true }),
}
