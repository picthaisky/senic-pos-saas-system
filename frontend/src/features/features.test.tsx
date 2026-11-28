import { fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { inventoryApi } from '@/features/inventory/api'
import { useCartStore } from '@/features/pos/cart-store'
import { DEFAULT_SHOP_SETTINGS } from '@/features/shop/api'
import { mockShopSettings } from '@/mocks/mock-data'
import { renderApp, signIn } from '@/test/render-app'

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

  it('deletes an item that was never sold, and says why a sold one stays', async () => {
    signIn()
    // Sorts first, so it is on the first page of the list.
    await inventoryApi.create({
      sku: 'NEVER-SOLD',
      name: 'กระดาษห่อของขวัญ',
      barcode: null,
      category: null,
      price: 5,
      cost: 2,
      quantity: 0,
      minimumStock: 0,
    })
    renderApp('/inventory')
    await screen.findByText('กระดาษห่อของขวัญ')

    async function remove(name: string) {
      fireEvent.click(screen.getByRole('button', { name: t('inventory.deleteNamed', { name }) }))
      const dialog = within(screen.getByRole('dialog', { name: t('inventory.deleteTitle') }))
      fireEvent.click(dialog.getByRole('button', { name: t('common.delete') }))
    }

    // The seeded sales include this item: bills still point at it.
    await remove('ขนมปังแผ่น')
    expect(await screen.findByText(/เคยถูกขายแล้ว จึงลบไม่ได้/)).toBeInTheDocument()
    expect(screen.getByText('ขนมปังแผ่น')).toBeInTheDocument()

    await remove('กระดาษห่อของขวัญ')
    expect(await screen.findByText(t('inventory.deleted'))).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByText('กระดาษห่อของขวัญ')).not.toBeInTheDocument())
  })
})

describe('point of sale', () => {
  beforeEach(() => useCartStore.getState().clear())
  afterEach(() => {
    mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS }
  })

  it('sells a scanned item and shows the totals returned for the order', async () => {
    // A shop registered for VAT whose prices are before tax.
    mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS, vatMode: 'Exclusive' }
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
    expect(cart.getByText('ภาษี (7%)')).toBeInTheDocument()

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
