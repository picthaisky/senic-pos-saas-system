import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '@/app/router'
import { Toaster } from '@/components/ui'
import { api } from '@/lib/api'
import { installMockApi } from '@/mocks/mock-api'
import { type Role, useAuthStore } from '@/stores/auth'

let mockInstalled = false

/**
 * Points the API client at the in-memory mock and signs in (anonymous when `role` is null,
 * still checking the session when it is 'loading'). The test user belongs to tenant "t1".
 * Use this on its own to test modules without rendering any screen.
 */
export function signIn(role: Role | null | 'loading' = 'Owner') {
  if (!mockInstalled) {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    installMockApi(api, { delayMs: 0 })
    mockInstalled = true
  }

  if (role === 'loading') {
    useAuthStore.setState({ status: 'loading', user: null, accessToken: null })
  } else if (role) {
    useAuthStore.getState().setSession({
      accessToken: 'token',
      expiresAt: '',
      user: { id: 'u1', email: 'user@shop.test', name: 'Somchai', tenantId: 't1', role },
    })
  } else {
    useAuthStore.getState().clearSession()
  }
}

/**
 * Renders the real routes at `path` for the given role (see `signIn`), backed by the in-memory
 * mock API. Mock data is shared within one test file.
 */
export function renderApp(path: string, role: Role | null | 'loading' = 'Owner') {
  signIn(role)

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  )
  return router
}
