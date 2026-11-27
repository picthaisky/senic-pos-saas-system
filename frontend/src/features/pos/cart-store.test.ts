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

  it('totals the cart with 7% tax rounded to satang', () => {
    cart().addItem(item({ id: 'a', price: 19.99, quantity: 9 }))
    cart().setQuantity('a', 3)
    cart().addItem(item({ id: 'b', price: 5.5, quantity: 9 }))

    // 3 × 19.99 + 5.50 = 65.47; tax 4.5829 → 4.58
    expect(cartTotals(cart().lines)).toEqual({
      itemCount: 4,
      subtotal: 65.47,
      tax: 4.58,
      total: 70.05,
    })
  })

  it('issues a new idempotency key when the cart is cleared', () => {
    const first = cart().clientOrderId
    cart().clear()
    expect(cart().clientOrderId).not.toBe(first)
  })
})
