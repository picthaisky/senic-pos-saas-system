import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { installMockApi } from '@/mocks/mock-api'
import { App } from './App'

// End-to-end through the real router, auth store and axios client, with /auth/* answered by
// the same mock the dev server uses.
describe('App sign-in flow', () => {
  beforeAll(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    installMockApi(api)
  })

  it('signs in, shows the menu for the role, restores the session and signs out', async () => {
    const first = render(<App />)

    // No refresh cookie yet, so the startup check lands on the login page.
    await screen.findByRole('form', { name: i18n.t('auth.title') })
    fireEvent.change(screen.getByLabelText(i18n.t('auth.tenantId')), {
      target: { value: 'shop-1' },
    })
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), {
      target: { value: 'cashier@shop.test' },
    })
    fireEvent.change(screen.getByLabelText(i18n.t('auth.password')), {
      target: { value: 'secret-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('auth.submit') }))

    // A cashier starts on the till: the dashboard is for roles that may see sales figures.
    await screen.findByRole('heading', { name: i18n.t('nav.pos') })
    expect(screen.getByText(i18n.t('roles.Cashier'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: i18n.t('nav.pos') })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: i18n.t('nav.inventory') })).not.toBeInTheDocument()

    // A reload keeps the user signed in via the refresh call.
    first.unmount()
    render(<App />)
    await screen.findByRole('heading', { name: i18n.t('nav.pos') })

    fireEvent.click(screen.getByRole('button', { name: i18n.t('topbar.logout') }))
    await screen.findByRole('form', { name: i18n.t('auth.title') })
  })

  it('rejects wrong credentials with a message and stays on the login page', async () => {
    render(<App />)

    await screen.findByRole('form', { name: i18n.t('auth.title') })
    fireEvent.change(screen.getByLabelText(i18n.t('auth.tenantId')), {
      target: { value: 'shop-1' },
    })
    fireEvent.change(screen.getByLabelText(i18n.t('auth.email')), {
      target: { value: 'owner@shop.test' },
    })
    // The mock treats passwords under 6 characters as wrong; the form blocks those itself.
    fireEvent.change(screen.getByLabelText(i18n.t('auth.password')), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: i18n.t('auth.submit') }))

    expect(await screen.findByText(i18n.t('auth.passwordTooShort'))).toBeInTheDocument()
    expect(screen.getByRole('form', { name: i18n.t('auth.title') })).toBeInTheDocument()
  })
})
