import { act, fireEvent, screen, within } from '@testing-library/react'
import { customersApi } from '@/features/customers/api'
import { useCartStore } from '@/features/pos/cart-store'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { mockShopSettings } from '@/mocks/mock-data'
import { useNetworkStore } from '@/stores/network'
import { renderApp } from '@/test/render-app'
import { DEFAULT_SHOP_SETTINGS } from './api'

// Against the in-memory mock API, which prices bills with the same module as the till and
// keeps the shop's settings in `mockShopSettings`. Seed data: "น้ำดื่ม 600 มล." costs ฿10
// (barcode 8850000000001); สมชาย ใจดี has 120 points.

const t = i18n.t.bind(i18n)
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS }
  localStorage.clear()
  useCartStore.getState().clear()
})

describe('shop settings page', () => {
  it('starts from a shop without VAT or points, and saves what the owner sets', async () => {
    renderApp('/settings')
    expect(await screen.findByLabelText(t('settings.vatMode'))).toHaveValue('None')
    // No rate to fill in while the shop is not registered.
    expect(screen.queryByLabelText(t('settings.vatRate'))).not.toBeInTheDocument()
    expect(screen.getByText(t('settings.pointsOff'))).toBeInTheDocument()

    type(t('settings.shopName'), 'ร้านทดสอบ')
    type(t('settings.taxId'), '0105556000001')
    type(t('settings.vatMode'), 'Inclusive')
    expect(screen.getByLabelText(t('settings.vatRate'))).toHaveValue('7')
    type(t('settings.bahtPerPoint'), '25')
    expect(screen.getByText(t('settings.pointsExample', { points: 40 }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('settings.saved'))).toBeInTheDocument()
    expect(mockShopSettings.current).toMatchObject({
      shopName: 'ร้านทดสอบ',
      taxId: '0105556000001',
      vatMode: 'Inclusive',
      vatRatePercent: 7,
      bahtPerPoint: 25,
      address: null,
    })
  })

  it('does not send a tax ID that is not 13 digits', async () => {
    renderApp('/settings')
    await screen.findByLabelText(t('settings.vatMode'))
    const put = vi.spyOn(api, 'put')

    type(t('settings.taxId'), '12345')
    fireEvent.click(screen.getByRole('button', { name: t('common.save') }))

    expect(await screen.findByText(t('settings.taxIdInvalid'))).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
    put.mockRestore()
  })

  it('is closed to a cashier', async () => {
    renderApp('/settings', 'Cashier')
    await screen.findByRole('heading', { name: t('forbidden.title') })
  })
})

describe('the till, with discounts, VAT in the prices and points', () => {
  it('prices the cart like the server will, and the customer earns points on what they pay', async () => {
    mockShopSettings.current = {
      ...DEFAULT_SHOP_SETTINGS,
      vatMode: 'Inclusive',
      bahtPerPoint: 25,
    }
    renderApp('/pos', 'Cashier')
    const barcode = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })
    fireEvent.change(barcode, { target: { value: '8850000000001' } })
    fireEvent.submit(barcode.closest('form')!)

    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    await cart.findByText('น้ำดื่ม 600 มล.')
    const more = cart.getByRole('button', {
      name: t('pos.increaseNamed', { name: 'น้ำดื่ม 600 มล.' }),
    })
    for (let n = 0; n < 5; n++) fireEvent.click(more)

    // 6 × 10 = 60, less 5 on the line = 55, less 10% of the bill = 49.50.
    fireEvent.change(cart.getByLabelText(t('pos.lineDiscountNamed', { name: 'น้ำดื่ม 600 มล.' })), {
      target: { value: '5' },
    })
    fireEvent.change(cart.getByLabelText(t('pos.billDiscountKind')), {
      target: { value: 'percent' },
    })
    fireEvent.change(cart.getByLabelText(t('pos.billDiscount')), { target: { value: '10' } })

    expect(await cart.findByText('฿49.50')).toBeInTheDocument()
    expect(cart.getByText('-฿10.50')).toBeInTheDocument()
    // The tax is inside the price: 49.50 × 7/107 = 3.238.
    const taxRow = cart.getByText(t('pos.taxIncluded', { rate: 7 })).closest('div')!
    expect(taxRow).toHaveTextContent('฿3.24')

    // Points are for a known customer only.
    expect(cart.queryByText(t('pos.pointsToEarn'))).not.toBeInTheDocument()
    const somchai = (await customersApi.list()).find((c) => c.firstName === 'สมชาย')!
    await cart.findByRole('option', { name: somchai.fullName })
    fireEvent.change(cart.getByLabelText(t('pos.customer')), { target: { value: somchai.id } })
    expect(cart.getByText(t('pos.pointsToEarn')).closest('div')).toHaveTextContent('+1')

    fireEvent.click(cart.getByRole('button', { name: t('pos.checkout') }))

    // The saved bill says the same.
    const receipt = within(await screen.findByRole('dialog', { name: t('pos.orderCreated') }))
    expect(receipt.getByText('฿49.50')).toBeInTheDocument()
    expect(receipt.getByText('฿3.24')).toBeInTheDocument()
    expect(receipt.getByText('-฿5.50')).toBeInTheDocument()
    expect(receipt.getByText('+1')).toBeInTheDocument()
    const after = (await customersApi.list()).find((c) => c.id === somchai.id)!
    expect(after.loyaltyPoints).toBe(somchai.loyaltyPoints + 1)
  })

  it('shows no tax at all in a shop without VAT', async () => {
    renderApp('/pos', 'Cashier')
    const barcode = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })
    fireEvent.change(barcode, { target: { value: '8850000000001' } })
    fireEvent.submit(barcode.closest('form')!)

    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    await cart.findByText('น้ำดื่ม 600 มล.')

    expect(cart.queryByText(/7%/)).not.toBeInTheDocument()
    fireEvent.click(cart.getByRole('button', { name: t('pos.checkout') }))
    const receipt = within(await screen.findByRole('dialog', { name: t('pos.orderCreated') }))
    expect(receipt.getByText('฿10.00')).toBeInTheDocument()
    expect(receipt.queryByText(/7%/)).not.toBeInTheDocument()
  })

  it('takes the points back when the bill is cancelled, and says why in the history', async () => {
    mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS, bahtPerPoint: 5 }
    const somchai = (await customersApi.list()).find((c) => c.firstName === 'สมชาย')!
    const [water] = (await api.get('/inventory', { params: { search: 'น้ำดื่ม', page: 1 } })).data
      .items
    const order = (
      await api.post('/orders', {
        customerId: somchai.id,
        paymentMethod: 'Cash',
        discountAmount: 0,
        notes: null,
        clientOrderId: crypto.randomUUID(),
        items: [{ inventoryItemId: water.id, quantity: 4, discount: 0 }],
      })
    ).data
    expect(order.pointsEarned).toBe(8)
    await api.post(`/orders/${order.id}/cancel`)

    renderApp('/customers')
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('customers.viewNamed', { name: somchai.fullName }),
      }),
    )

    const history = within(await screen.findByRole('region', { name: t('customers.history') }))
    expect(
      await history.findByText(t('customers.fromSale', { number: order.orderNumber })),
    ).toBeInTheDocument()
    expect(
      history.getByText(t('customers.fromCancel', { number: order.orderNumber })),
    ).toBeInTheDocument()
    const balance = (await customersApi.list()).find((c) => c.id === somchai.id)!.loyaltyPoints
    expect(balance).toBe(somchai.loyaltyPoints)
  })

  it('uses the points of a customer as a discount, and gives them back when the bill is cancelled', async () => {
    mockShopSettings.current = {
      ...DEFAULT_SHOP_SETTINGS,
      vatMode: 'Inclusive',
      bahtPerPoint: 5,
      pointValueBaht: 0.5,
    }
    renderApp('/pos', 'Cashier')
    const barcode = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })
    fireEvent.change(barcode, { target: { value: '8850000000001' } })
    fireEvent.submit(barcode.closest('form')!)
    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    await cart.findByText('น้ำดื่ม 600 มล.')

    // A walk-in customer has no points to use.
    expect(cart.queryByLabelText(t('pos.usePoints'))).not.toBeInTheDocument()
    const somchai = (await customersApi.list()).find((c) => c.firstName === 'สมชาย')!
    await cart.findByRole('option', { name: somchai.fullName })
    fireEvent.change(cart.getByLabelText(t('pos.customer')), { target: { value: somchai.id } })

    // ฿10 at ฿0.50 a point: 19 points leave ฿0.50 to pay; 20 would leave nothing.
    const points = await cart.findByLabelText(t('pos.usePoints'))
    fireEvent.change(points, { target: { value: '500' } })
    expect(points).toHaveValue(19)
    fireEvent.change(points, { target: { value: '8' } })
    expect(
      cart.getByText(t('pos.pointsDiscount', { points: '8' })).closest('div'),
    ).toHaveTextContent('-฿4.00')
    // 6.00 is paid: the tax is 7/107 of that, and it earns one point.
    expect(cart.getByText(t('pos.taxIncluded', { rate: 7 })).closest('div')).toHaveTextContent(
      '฿0.39',
    )
    expect(cart.getByText(t('pos.pointsToEarn')).closest('div')).toHaveTextContent('+1')

    fireEvent.click(cart.getByRole('button', { name: t('pos.checkout') }))
    const receipt = within(await screen.findByRole('dialog', { name: t('pos.orderCreated') }))
    expect(receipt.getByText('฿6.00')).toBeInTheDocument()
    expect(receipt.getByText('-฿4.00')).toBeInTheDocument()
    const after = (await customersApi.list()).find((c) => c.id === somchai.id)!
    expect(after.loyaltyPoints).toBe(somchai.loyaltyPoints - 8 + 1)

    const sold = (await api.get('/orders', { params: { page: 1 } })).data.items[0]
    expect(sold).toMatchObject({ pointsRedeemed: 8, pointsDiscount: 4, netAmount: 6 })
    await api.post(`/orders/${sold.id}/cancel`)
    const back = (await customersApi.list()).find((c) => c.id === somchai.id)!
    expect(back.loyaltyPoints).toBe(somchai.loyaltyPoints)
  })

  it('does not take points while the till is offline', async () => {
    mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS, pointValueBaht: 1 }
    renderApp('/pos', 'Cashier')
    const barcode = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })
    fireEvent.change(barcode, { target: { value: '8850000000001' } })
    fireEvent.submit(barcode.closest('form')!)
    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    await cart.findByText('น้ำดื่ม 600 มล.')
    const somchai = (await customersApi.list()).find((c) => c.firstName === 'สมชาย')!
    await cart.findByRole('option', { name: somchai.fullName })
    fireEvent.change(cart.getByLabelText(t('pos.customer')), { target: { value: somchai.id } })
    const points = await cart.findByLabelText(t('pos.usePoints'))
    fireEvent.change(points, { target: { value: '5' } })
    expect(cart.getByText('฿5.00')).toBeInTheDocument()

    act(() => useNetworkStore.setState({ online: false }))
    try {
      expect(cart.getByLabelText(t('pos.usePoints'))).toBeDisabled()
      expect(cart.getByText(t('pos.usePointsOffline'))).toBeInTheDocument()
      // The bill is back at its full price: the points are not counted.
      expect(cart.queryByText(t('pos.pointsDiscount', { points: '5' }))).not.toBeInTheDocument()
    } finally {
      act(() => useNetworkStore.setState({ online: true }))
    }
  })
})
