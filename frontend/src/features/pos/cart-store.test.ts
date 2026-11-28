import type { InventoryItem } from '@/features/inventory/types'
import { cartTotals, useCartStore } from './cart-store'

const item = (overrides: Partial<InventoryItem>): InventoryItem => ({
  id: 'i1',
  sku: 'SKU-1',
  name: 'Water',
  description: null,
  barcode: null,
  price: 10,
  cost: 6,
  quantity: 2,
  minimumStock: 1,
  category: null,
  imageUrl: null,
  isActive: true,
  createdAt: '',
  ...overrides,
})

const cart = () => useCartStore.getState()

beforeEach(() => cart().clear())

describe('cart store', () => {
  it('merges repeated adds into one line and stops at the stock on hand', () => {
    const water = item({ quantity: 2 })

    expect(cart().addItem(water)).toBe(true)
    expect(cart().addItem(water)).toBe(true)
    expect(cart().addItem(water)).toBe(false)

    expect(cart().lines).toHaveLength(1)
    expect(cart().lines[0].quantity).toBe(2)
  })

  it('refuses an item that is out of stock', () => {
    expect(cart().addItem(item({ quantity: 0 }))).toBe(false)
    expect(cart().lines).toHaveLength(0)
  })

  it('clamps a typed quantity to stock and removes the line at zero', () => {
    cart().addItem(item({ quantity: 5 }))

    cart().setQuantity('i1', 99)
    expect(cart().lines[0].quantity).toBe(5)

    cart().setQuantity('i1', 0)
    expect(cart().lines).toHaveLength(0)
  })

  it('totals the cart with its discounts, by the VAT mode of the shop', () => {
    cart().addItem(item({ id: 'a', price: 19.99, quantity: 9 }))
    cart().setQuantity('a', 3)
    cart().addItem(item({ id: 'b', price: 5.5, quantity: 9 }))
    const exclusive = { vatMode: 'Exclusive', vatRatePercent: 7 } as const

    // 3 × 19.99 + 5.50 = 65.47; tax 4.5829 → 4.58
    expect(cartTotals(cart().lines, cart().billDiscount, exclusive)).toEqual({
      itemCount: 4,
      gross: 65.47,
      lineDiscounts: 0,
      itemsTotal: 65.47,
      billDiscount: 0,
      pointsDiscount: 0,
      tax: 4.58,
      total: 70.05,
    })

    cart().setLineDiscount('b', 0.47)
    cart().setBillDiscount({ kind: 'percent', value: 10 })
    // 65.00 less 10% = 58.50; tax 4.095 → 4.10
    expect(cartTotals(cart().lines, cart().billDiscount, exclusive)).toMatchObject({
      lineDiscounts: 0.47,
      billDiscount: 6.5,
      tax: 4.1,
      total: 62.6,
    })
  })

  it('starts each sale without discounts', () => {
    cart().addItem(item({}))
    cart().setLineDiscount('i1', 3)
    cart().setBillDiscount({ kind: 'amount', value: 5 })
    // Nonsense typed into a field is no discount.
    cart().setBillDiscount({ kind: 'amount', value: Number.NaN })
    expect(cart().billDiscount.value).toBe(0)

    cart().clear()
    cart().addItem(item({}))

    expect(cart().lines[0].discount).toBe(0)
    expect(cart().billDiscount).toEqual({ kind: 'amount', value: 0 })
  })

  it('issues a new idempotency key when the cart is cleared', () => {
    const first = cart().clientOrderId
    cart().clear()
    expect(cart().clientOrderId).not.toBe(first)
  })
})
