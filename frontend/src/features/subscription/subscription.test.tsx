import { screen } from '@testing-library/react'
import i18n from '@/i18n'
import { formatCurrency } from '@/lib/format'
import { mockSubscription } from '@/mocks/mock-data'
import { renderApp } from '@/test/render-app'

// Against the in-memory mock API, whose subscription the tests replace.

const t = i18n.t.bind(i18n)
const original = mockSubscription.current!

afterEach(() => {
  mockSubscription.current = original
})

describe('subscription page', () => {
  it('shows the plan, status, fee and time left, and says when the end is near', async () => {
    renderApp('/subscription')

    expect(await screen.findByText('ร้านตัวอย่าง')).toBeInTheDocument()
    expect(screen.getByText(t('subscription.plans.Pro'))).toBeInTheDocument()
    expect(screen.getByText(t('subscription.statuses.Active'))).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(590))).toBeInTheDocument()
    expect(screen.getByText(t('subscription.days', { count: 10 }))).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(t('subscription.endingSoon', { count: 10 }))
  })

  it('gives no warning while the end is far away', async () => {
    mockSubscription.current = { ...original, daysUntilExpiry: 200 }
    renderApp('/subscription')

    expect(await screen.findByText(t('subscription.days', { count: 200 }))).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says so when the subscription has ended', async () => {
    mockSubscription.current = { ...original, status: 'Expired', daysUntilExpiry: -3 }
    renderApp('/subscription')

    expect(await screen.findByRole('alert')).toHaveTextContent(t('subscription.ended'))
    expect(screen.getByText(t('subscription.statuses.Expired'))).toBeInTheDocument()
  })

  it('explains when the shop has no subscription on record', async () => {
    mockSubscription.current = null
    renderApp('/subscription')

    expect(await screen.findByText(t('subscription.none'))).toBeInTheDocument()
  })

  it('is closed to a cashier', async () => {
    renderApp('/subscription', 'Cashier')
    await screen.findByRole('heading', { name: t('forbidden.title') })
  })
})
