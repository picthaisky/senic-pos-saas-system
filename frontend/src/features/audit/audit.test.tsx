import { fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'

// Against the fixed history of the in-memory mock API (src/mocks/mock-data.ts).

const t = i18n.t.bind(i18n)
const rowOf = (text: string) =>
  within(within(screen.getByRole('table')).getByText(text).closest('tr')!)

describe('change history page', () => {
  it('shows who changed what, with old and new values in plain words', async () => {
    renderApp('/audit')
    await screen.findByText('ข้าวสาร 1 กก.')

    const stock = rowOf('ข้าวสาร 1 กก.')
    expect(stock.getByText('Somchai')).toBeInTheDocument()
    expect(stock.getByText(t('audit.actions.Updated'))).toBeInTheDocument()
    const quantity = within(stock.getByText(t('audit.fields.quantity')).closest('li')!)
    expect(quantity.getByText('3')).toBeInTheDocument()
    expect(quantity.getByText('20')).toBeInTheDocument()

    // Enum values and booleans are translated; a cancelled bill reads as such.
    const bill = rowOf('ORD-20261126-AB12CD34')
    expect(bill.getByText(t('audit.values.Cancelled'))).toBeInTheDocument()
    const user = rowOf('wichai@shop.test')
    expect(user.getByText(t('roles.Viewer'))).toBeInTheDocument()
    expect(user.getByText(t('audit.no'))).toBeInTheDocument()

    // A password change is listed, but no value is shown for it.
    const password = user.getByText(t('audit.fields.passwordHash')).closest('li')!
    expect(password).not.toHaveTextContent('***')

    // The account that made this change no longer exists.
    expect(rowOf('ลูกค้า เก่า').getByText(t('audit.unknownUser'))).toBeInTheDocument()
  })

  it('filters by the kind of record', async () => {
    renderApp('/audit')
    await screen.findByText('ข้าวสาร 1 กก.')

    fireEvent.change(screen.getByLabelText(t('audit.filterType')), { target: { value: 'User' } })

    await vi.waitFor(() => expect(screen.queryByText('ข้าวสาร 1 กก.')).not.toBeInTheDocument())
    expect(screen.getByText('wichai@shop.test')).toBeInTheDocument()
    expect(
      screen.getByText(t('pagination.range', { from: 1, to: 1, total: 1 })),
    ).toBeInTheDocument()
  })

  it('is closed to a cashier', async () => {
    renderApp('/audit', 'Cashier')
    await screen.findByRole('heading', { name: t('forbidden.title') })
  })
})
