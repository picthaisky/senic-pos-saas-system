import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import i18n from '@/i18n'
import { type Role, useAuthStore } from '@/stores/auth'
import { routes } from './router'

function signInAs(role: Role) {
  useAuthStore.getState().setSession({
    accessToken: 'token',
    expiresAt: '',
    user: { id: 'u1', email: 'user@shop.test', name: 'Somchai', tenantId: 't1', role },
  })
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const navLinks = () => screen.getAllByRole('link').map((link) => link.getAttribute('href'))

describe('routing', () => {
  it('sends anonymous visitors to the login page and remembers where they were going', () => {
    useAuthStore.getState().clearSession()

    const router = renderAt('/inventory?lowStock=true')

    expect(screen.getByRole('form', { name: i18n.t('auth.title') })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/auth/login')
    expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(
      '/inventory?lowStock=true',
    )
  })

  it('waits for the session check instead of redirecting while auth is loading', () => {
    useAuthStore.setState({ status: 'loading', user: null, accessToken: null })

    const router = renderAt('/inventory')

    expect(screen.getByRole('status', { name: i18n.t('common.loading') })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inventory')
  })

  it('returns a signed-in user from the login page to the requested page', () => {
    signInAs('Owner')

    const router = renderAt('/auth/login?returnUrl=%2Fcustomers')

    expect(router.state.location.pathname).toBe('/customers')
  })

  it('ignores a returnUrl that points to another site', () => {
    signInAs('Owner')

    const router = renderAt('/auth/login?returnUrl=%2F%2Fevil.example')

    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('shows an owner every menu item and opens the dashboard by default', () => {
    signInAs('Owner')

    const router = renderAt('/')

    expect(router.state.location.pathname).toBe('/dashboard')
    expect(navLinks()).toEqual(['/dashboard', '/pos', '/inventory', '/customers'])
    expect(screen.getByRole('heading', { name: i18n.t('nav.dashboard') })).toBeInTheDocument()
  })

  it('hides restricted menu items from a cashier and blocks the page itself', () => {
    signInAs('Cashier')

    renderAt('/inventory')

    expect(screen.getByRole('heading', { name: i18n.t('forbidden.title') })).toBeInTheDocument()
    expect(navLinks()).not.toContain('/inventory')
    expect(navLinks()).toContain('/pos')
  })
})
