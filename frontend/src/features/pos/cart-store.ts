import { create } from 'zustand'
import type { InventoryItem } from '@/features/inventory/types'
import type { PaymentMethod } from './types'

export interface CartLine {
  inventoryItemId: string
  name: string
  unitPrice: number
  quantity: number
  /** Stock on hand when the item was added; the quantity cannot exceed it. */
  available: number
}

interface CartState {
  lines: CartLine[]
  customerId: string | null
  paymentMethod: PaymentMethod
  /** Idempotency key for the order this cart becomes; renewed whenever the cart is cleared. */
  clientOrderId: string
  /** Adds one unit. Returns false when the item is already at its stock limit. */
  addItem: (item: InventoryItem) => boolean
  /** Clamped to the stock limit; zero or less removes the line. */
  setQuantity: (inventoryItemId: string, quantity: number) => void
  removeItem: (inventoryItemId: string) => void
  setCustomer: (customerId: string | null) => void
  setPaymentMethod: (method: PaymentMethod) => void
  clear: () => void
}

const emptyCart = () => ({
  lines: [] as CartLine[],
  customerId: null,
  paymentMethod: 'Cash' as PaymentMethod,
  clientOrderId: crypto.randomUUID(),
})

export const useCartStore = create<CartState>((set, get) => ({
  ...emptyCart(),

  addItem: (item) => {
    const existing = get().lines.find((line) => line.inventoryItemId === item.id)
    if ((existing?.quantity ?? 0) >= item.quantity) return false
    if (existing) {
      get().setQuantity(item.id, existing.quantity + 1)
    } else {
      const line: CartLine = {
        inventoryItemId: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: 1,
        available: item.quantity,
      }
      set({ lines: [...get().lines, line] })
    }
    return true
  },

  setQuantity: (inventoryItemId, quantity) =>
    set({
      lines: get()
        .lines.map((line) =>
          line.inventoryItemId === inventoryItemId
            ? { ...line, quantity: Math.min(quantity, line.available) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    }),

  removeItem: (inventoryItemId) =>
    set({ lines: get().lines.filter((line) => line.inventoryItemId !== inventoryItemId) }),

  setCustomer: (customerId) => set({ customerId }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  clear: () => set(emptyCart()),
}))

/** Shown to the user as a whole number; 0.07 * 100 is 7.000000000000001 in floating point. */
export const TAX_PERCENT = 7
export const TAX_RATE = TAX_PERCENT / 100

const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * On-screen estimate only: the amounts on the saved order come from the backend. The cart has
 * no discounts, so this matches the backend's formula (tax = 7% of the item total).
 */
export function cartTotals(lines: CartLine[]) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0))
  const tax = roundMoney(subtotal * TAX_RATE)
  return {
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    tax,
    total: roundMoney(subtotal + tax),
  }
}
