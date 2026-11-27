import { fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { useCartStore } from '@/features/pos/cart-store'
import { renderApp } from '@/test/render-app'

// Screen-level tests against the in-memory mock API (src/mocks/mock-data.ts), whose seed data
// these tests rely on: "น้ำดื่ม 600 มล." costs ฿10 with barcode 8850000000001 and 120 in stock;
// "ข้าวสาร 1 กก." is low on stock; "ช็อกโกแลตแท่ง" is out of stock; สมชาย ใจดี has 120 points.

const t = i18n.t.bind(i18n)
const type = (
  label: string,
  value: string,
  container: Pick<typeof screen, 'getByLabelText'> = screen,
) => fireEvent.change(container.getByLabelText(label), { target: { value } })

describe('inventory page', () => {
  it('filters to low-stock items', async () => {
    renderApp('/inventory')
    await screen.findByText('น้ำดื่ม 600 มล.')

    fireEvent.click(screen.getByRole('button', { name: t('inventory.lowStock') }))

    await screen.findByText('ข้าวสาร 1 กก.')
    await vi.waitFor(() => expect(screen.queryByText('น้ำดื่ม 600 มล.')).not.toBeInTheDocument())
  })

  it('validates the form, then adds a new item to the list', async () => {
    renderApp('/inventory')
    await screen.findByText('น้ำดื่ม 600 มล.')

    fireEvent.click(screen.getByRole('button', { name: t('inventory.addItem') }))
    const dialog = within(screen.getByRole('dialog', { name: t('inventory.addItem') }))
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))
    expect(await dialog.findAllByText(t('validation.required'))).toHaveLength(2)

    type(t('inventory.name'), 'ปากกาลูกลื่น', dialog)
    type(t('inventory.sku'), 'SKU-900', dialog)
    type(t('inventory.price'), '12', dialog)
    type(t('inventory.quantity'), '50', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('inventory.saved'))).toBeInTheDocument()
    expect(await screen.findByText('ปากกาลูกลื่น')).toBeInTheDocument()
  })

  it('deletes an item after confirmation', async () => {
    renderApp('/inventory')
    await screen.findByText('ขนมปังแผ่น')

    fireEvent.click(
      screen.getByRole('button', { name: t('inventory.deleteNamed', { name: 'ขนมปังแผ่น' }) }),
    )
    const dialog = within(screen.getByRole('dialog', { name: t('inventory.deleteTitle') }))
    fireEvent.click(dialog.getByRole('button', { name: t('common.delete') }))

    expect(await screen.findByText(t('inventory.deleted'))).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByText('ขนมปังแผ่น')).not.toBeInTheDocument())
  })
})

describe('point of sale', () => {
  beforeEach(() => useCartStore.getState().clear())

  it('sells a scanned item and shows the totals returned for the order', async () => {
    renderApp('/pos', 'Cashier')
    const barcodeInput = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })

    fireEvent.change(barcodeInput, { target: { value: '8850000000001' } })
    fireEvent.submit(barcodeInput.closest('form')!)

    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    await cart.findByText('น้ำดื่ม 600 มล.')
    fireEvent.click(
      cart.getByRole('button', { name: t('pos.increaseNamed', { name: 'น้ำดื่ม 600 มล.' }) }),
    )
    // 2 × ฿10 + 7% tax
    expect(cart.getByText('฿21.40')).toBeInTheDocument()

    fireEvent.click(cart.getByRole('button', { name: t('pos.checkout') }))

    const receipt = within(await screen.findByRole('dialog', { name: t('pos.orderCreated') }))
    expect(receipt.getByText(/^ORD-\d{5}$/)).toBeInTheDocument()
    expect(receipt.getByText('฿21.40')).toBeInTheDocument()
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('does not let an out-of-stock item be added from search', async () => {
    renderApp('/pos', 'Cashier')
    const searchInput = await screen.findByLabelText(t('pos.searchProducts'))

    fireEvent.change(searchInput, { target: { value: 'ช็อกโกแลต' } })
    fireEvent.submit(searchInput.closest('form')!)

    const product = await screen.findByRole('button', { name: /ช็อกโกแลตแท่ง/ })
    expect(product).toBeDisabled()
    expect(within(product).getByText(t('pos.outOfStock'))).toBeInTheDocument()
  })

  it('tells the cashier when a barcode matches nothing', async () => {
    renderApp('/pos', 'Cashier')
    const barcodeInput = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })

    fireEvent.change(barcodeInput, { target: { value: '000' } })
    fireEvent.submit(barcodeInput.closest('form')!)

    expect(
      await screen.findByText(t('pos.barcodeNotFound', { barcode: '000' })),
    ).toBeInTheDocument()
  })
})

describe('customers page', () => {
  it('redeems points and updates the balance and history', async () => {
    renderApp('/customers')
    await screen.findByText('สมชาย ใจดี')

    fireEvent.click(
      screen.getByRole('button', { name: t('customers.viewNamed', { name: 'สมชาย ใจดี' }) }),
    )
    fireEvent.click(await screen.findByRole('button', { name: t('customers.redeem') }))
    const dialog = within(screen.getByRole('dialog', { name: /สมชาย ใจดี/ }))

    type(t('customers.points'), '500', dialog)
    expect(dialog.getByRole('alert')).toHaveTextContent(t('customers.notEnoughPoints'))
    expect(dialog.getByRole('button', { name: t('customers.redeem') })).toBeDisabled()

    type(t('customers.points'), '20', dialog)
    fireEvent.click(dialog.getByRole('button', { name: t('customers.redeem') }))

    expect(await screen.findByText(t('customers.redeemed'))).toBeInTheDocument()
    const history = within(screen.getByRole('region', { name: t('customers.history') }))
    expect(await history.findByText('−20')).toBeInTheDocument()
    expect(screen.getAllByText('100').length).toBeGreaterThan(0)
  })

  it('adds a customer and rejects a malformed phone number', async () => {
    renderApp('/customers')
    await screen.findByText('สมชาย ใจดี')

    type(t('customers.firstName'), 'มานี')
    type(t('customers.phone'), '12345')
    const addButtons = screen.getAllByRole('button', { name: t('customers.addCustomer') })
    fireEvent.click(addButtons[0])
    expect(await screen.findByText(t('validation.phone'))).toBeInTheDocument()

    type(t('customers.phone'), '0811111111')
    fireEvent.click(addButtons[0])

    expect(await screen.findByText(t('customers.created'))).toBeInTheDocument()
    expect(await screen.findByText('มานี')).toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('shows the sales figures for the period', async () => {
    renderApp('/dashboard', 'Viewer')

    expect(await screen.findByText(t('dashboard.averageOrder'))).toBeInTheDocument()
    const table = within(screen.getByRole('table', { name: t('dashboard.salesByDay') }))
    // 7 days plus the header row
    expect(table.getAllByRole('row')).toHaveLength(8)
    expect(screen.getByRole('table', { name: t('dashboard.topItems') })).toBeInTheDocument()
  })
})
