import { fireEvent, render, screen, within } from '@testing-library/react'
import { useCartStore } from '@/features/pos/cart-store'
import type { Order } from '@/features/pos/types'
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from '@/features/shop/api'
import i18n from '@/i18n'
import { mockShopSettings } from '@/mocks/mock-data'
import { renderApp } from '@/test/render-app'
import { Receipt } from './Receipt'

const t = i18n.t.bind(i18n)
const th = i18n.getFixedT('th')

const shop: ShopSettings = {
  ...DEFAULT_SHOP_SETTINGS,
  shopName: 'ร้านทดสอบ',
  address: '1 ถนนทดสอบ กรุงเทพฯ',
  phone: '021234567',
  taxId: '0105556000001',
  branch: 'สำนักงานใหญ่',
  receiptFooter: 'ขอบคุณที่อุดหนุน',
}

/** The worked cart of the tax rules, as the server saves it for prices that include VAT. */
const order: Order = {
  id: 'o1',
  orderNumber: 'ORD-20261128-AB12CD34',
  customerId: 'c1',
  customerName: 'สมชาย ใจดี',
  totalAmount: 353.5,
  discountAmount: 17.68,
  taxAmount: 21.97,
  netAmount: 335.82,
  vatMode: 'Inclusive',
  vatRatePercent: 7,
  pointsEarned: 13,
  pointsRedeemed: 0,
  pointsDiscount: 0,
  soldByName: 'สมหญิง รักงาน',
  status: 'Completed',
  paymentMethod: 'Cash',
  createdAt: '2026-11-28T03:15:00Z',
  completedAt: '2026-11-28T03:15:00Z',
  items: [
    {
      id: 'l1',
      inventoryItemId: 'a',
      itemName: 'สินค้า ก',
      quantity: 2,
      unitPrice: 59,
      discount: 10,
      subtotal: 108,
    },
    {
      id: 'l2',
      inventoryItemId: 'b',
      itemName: 'สินค้า ข',
      quantity: 1,
      unitPrice: 199,
      discount: 0,
      subtotal: 199,
    },
    {
      id: 'l3',
      inventoryItemId: 'c',
      itemName: 'สินค้า ค',
      quantity: 3,
      unitPrice: 15.5,
      discount: 0,
      subtotal: 46.5,
    },
  ],
}

const rowOf = (label: string) => screen.getByText(label).closest('div')!

describe('receipt', () => {
  it('shows the shop, the bill, every line and the amounts of a VAT-inclusive sale', () => {
    render(<Receipt order={order} shop={{ ...shop, vatMode: 'Inclusive' }} />)

    expect(screen.getByRole('heading', { name: th('receipt.title') })).toBeInTheDocument()
    expect(screen.getByText('ร้านทดสอบ')).toBeInTheDocument()
    expect(screen.getByText(/0105556000001/)).toHaveTextContent('สำนักงานใหญ่')
    expect(rowOf(th('receipt.number'))).toHaveTextContent('ORD-20261128-AB12CD34')
    expect(rowOf(th('receipt.customer'))).toHaveTextContent('สมชาย ใจดี')

    const first = within(screen.getByRole('rowheader', { name: /สินค้า ก/ }).closest('tr')!)
    expect(first.getByRole('rowheader')).toHaveTextContent('2 × 59.00')
    expect(first.getByRole('rowheader')).toHaveTextContent(
      th('receipt.lineDiscount', { amount: '10.00' }),
    )
    expect(first.getByRole('cell')).toHaveTextContent('108.00')

    expect(rowOf(th('receipt.itemsTotal'))).toHaveTextContent('353.50')
    expect(rowOf(th('receipt.billDiscount'))).toHaveTextContent('-17.68')
    expect(rowOf(th('receipt.total'))).toHaveTextContent('335.82')
    expect(rowOf(th('receipt.vatIncluded', { rate: 7 }))).toHaveTextContent('21.97')
    expect(rowOf(th('receipt.saved'))).toHaveTextContent('27.68')
    expect(rowOf(th('receipt.points'))).toHaveTextContent('+13')
    expect(screen.getByText('ขอบคุณที่อุดหนุน')).toBeInTheDocument()
    // It says what it is not: the system does not issue tax invoices.
    expect(screen.getByText(th('receipt.notTaxInvoice'))).toBeInTheDocument()
    expect(screen.queryByText(/^ใบกำกับภาษี/)).not.toBeInTheDocument()
  })

  it('shows the tax as an added line when prices are before VAT', () => {
    const exclusive: Order = { ...order, vatMode: 'Exclusive', taxAmount: 23.51, netAmount: 359.33 }
    render(<Receipt order={exclusive} shop={shop} />)

    expect(rowOf(th('receipt.vatAdded', { rate: 7 }))).toHaveTextContent('23.51')
    expect(rowOf(th('receipt.total'))).toHaveTextContent('359.33')
    expect(screen.queryByText(th('receipt.vatIncluded', { rate: 7 }))).not.toBeInTheDocument()
  })

  it('says nothing about VAT, tax invoices or a taxpayer number for a shop without VAT', () => {
    const plain: Order = { ...order, vatMode: 'None', vatRatePercent: 0, taxAmount: 0 }
    const { container } = render(<Receipt order={plain} shop={shop} />)

    expect(container).not.toHaveTextContent('ภาษี')
    expect(container).not.toHaveTextContent('VAT')
    expect(container).not.toHaveTextContent('0105556000001')
    expect(rowOf(th('receipt.total'))).toHaveTextContent('335.82')
  })

  it('follows the bill, not the current settings, and marks a cancelled bill', () => {
    // The shop has since stopped charging VAT; this bill was made with it.
    render(
      <Receipt order={{ ...order, status: 'Cancelled' }} shop={{ ...shop, vatMode: 'None' }} />,
    )

    expect(rowOf(th('receipt.vatIncluded', { rate: 7 }))).toHaveTextContent('21.97')
    expect(screen.getByText(th('receipt.cancelled'))).toBeInTheDocument()
  })

  it('is in Thai even when the screen is in English, and leaves out what the shop has not filled in', async () => {
    await i18n.changeLanguage('en')
    try {
      const withPoints: Order = { ...order, pointsRedeemed: 40, pointsDiscount: 20 }
      const used = render(<Receipt order={withPoints} shop={shop} />)
      expect(used.getByText('ส่วนลดจากแต้ม (40 แต้ม)').closest('div')).toHaveTextContent('-20.00')
      used.unmount()

      const walkIn: Order = { ...order, customerId: null, customerName: '', pointsEarned: 0 }
      const { container } = render(<Receipt order={walkIn} shop={DEFAULT_SHOP_SETTINGS} />)

      expect(screen.getByRole('heading', { name: 'ใบเสร็จรับเงิน' })).toBeInTheDocument()
      expect(screen.getByText('เงินสด')).toBeInTheDocument()
      expect(container).not.toHaveTextContent(th('receipt.customer'))
      expect(container).not.toHaveTextContent(th('receipt.points'))
    } finally {
      await i18n.changeLanguage('th')
    }
  })
})

describe('printing', () => {
  beforeEach(() => {
    mockShopSettings.current = {
      ...DEFAULT_SHOP_SETTINGS,
      shopName: 'ร้านทดสอบ',
      vatMode: 'Inclusive',
    }
    localStorage.clear()
    useCartStore.getState().clear()
    window.print = vi.fn()
  })

  afterEach(() => {
    mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS }
  })

  it('prints the receipt of the sale just made, and clears it once the browser is done', async () => {
    renderApp('/pos', 'Cashier')
    const barcode = await screen.findByLabelText(t('pos.scanBarcode'), { selector: 'input' })
    fireEvent.change(barcode, { target: { value: '8850000000001' } })
    fireEvent.submit(barcode.closest('form')!)
    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    await cart.findByText('น้ำดื่ม 600 มล.')
    fireEvent.click(cart.getByRole('button', { name: t('pos.checkout') }))
    const dialog = within(await screen.findByRole('dialog', { name: t('pos.orderCreated') }))
    expect(document.querySelector('.receipt-print')).toBeNull()

    fireEvent.click(dialog.getByRole('button', { name: t('receipt.print') }))

    await vi.waitFor(() => expect(window.print).toHaveBeenCalledOnce())
    const paper = within(document.querySelector<HTMLElement>('.receipt-print')!)
    expect(paper.getByText('ร้านทดสอบ')).toBeInTheDocument()
    expect(paper.getByRole('rowheader', { name: /น้ำดื่ม 600 มล\./ })).toBeInTheDocument()
    // 10.00 with the tax inside it: 10 × 7/107 = 0.65.
    expect(
      paper.getByText(th('receipt.vatIncluded', { rate: 7 })).closest('div'),
    ).toHaveTextContent('0.65')

    window.dispatchEvent(new Event('afterprint'))
    await vi.waitFor(() => expect(document.querySelector('.receipt-print')).toBeNull())
  })

  it('reprints an old bill from the sales history', async () => {
    renderApp('/orders')
    const view = (await screen.findAllByRole('button', { name: /^ดูรายละเอียด/ }))[0]
    fireEvent.click(view)
    const dialog = within(await screen.findByRole('dialog'))
    const number = dialog.getByRole('heading').textContent!

    fireEvent.click(dialog.getByRole('button', { name: t('receipt.print') }))

    await vi.waitFor(() => expect(window.print).toHaveBeenCalledOnce())
    expect(document.querySelector('.receipt-print')).toHaveTextContent(number)
  })
})
