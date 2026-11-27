import { screen } from '@testing-library/react'
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'

const navLinks = () => screen.getAllByRole('link').map((link) => link.getAttribute('href'))

describe('routing', () => {
  it('sends anonymous visitors to the login page and remembers where they were going', async () => {
    const router = renderApp('/inventory?lowStock=true', null)

    expect(await screen.findByRole('form', { name: i18n.t('auth.title') })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/auth/login')
    expect(new URLSearchParams(router.state.location.search).get('returnUrl')).toBe(
      '/inventory?lowStock=true',
    )
  })

  it('waits for the session check instead of redirecting while auth is loading', async () => {
    const router = renderApp('/inventory', 'loading')

    // Let the lazy route finish loading so a redirect would have happened by now.
    await vi.waitFor(() => expect(router.state.initialized).toBe(true))

    expect(screen.getByRole('status', { name: i18n.t('common.loading') })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/inventory')
  })

  it('returns a signed-in user from the login page to the requested page', async () => {
    const router = renderApp('/auth/login?returnUrl=%2Fcustomers')

    await screen.findByRole('heading', { name: i18n.t('nav.customers') })
    expect(router.state.location.pathname).toBe('/customers')
  })

  it('ignores a returnUrl that points to another site', async () => {
    const router = renderApp('/auth/login?returnUrl=%2F%2Fevil.example')

    await screen.findByRole('heading', { name: i18n.t('nav.dashboard') })
    expect(router.state.location.pathname).toBe('/dashboard')
  })

  it('shows an owner every menu item and opens the dashboard by default', async () => {
    const router = renderApp('/')

    await screen.findByRole('heading', { name: i18n.t('nav.dashboard') })
    expect(router.state.location.pathname).toBe('/dashboard')
    expect(navLinks()).toEqual(['/dashboard', '/pos', '/inventory', '/customers'])
  })

  it('hides restricted menu items from a cashier and blocks the page itself', async () => {
    renderApp('/inventory', 'Cashier')

    await screen.findByRole('heading', { name: i18n.t('forbidden.title') })
    expect(navLinks()).not.toContain('/inventory')
    expect(navLinks()).toContain('/pos')
  })
})
