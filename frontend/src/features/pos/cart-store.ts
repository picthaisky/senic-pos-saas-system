import { create } from 'zustand'
import type { InventoryItem } from '@/features/inventory/types'
import { type BillDiscount, billTotals, type VatSettings } from '@/features/shop/pricing'
import type { PaymentMethod } from './types'

export interface CartLine {
  inventoryItemId: string
  name: string
  unitPrice: number
  quantity: number
  /** Baht off this line; never more than the line is worth (see `lineDiscountOf`). */
  discount: number
  /** Stock on hand when the item was added; the quantity cannot exceed it. */
  available: number
}

interface CartState {
  lines: CartLine[]
  customerId: string | null
  paymentMethod: PaymentMethod
  /** Off the whole bill, after the line discounts. */
  billDiscount: BillDiscount
  /** Idempotency key for the order this cart becomes; renewed whenever the cart is cleared. */
  clientOrderId: string
  /** Adds one unit. Returns false when the item is already at its stock limit. */
  addItem: (item: InventoryItem) => boolean
  /** Clamped to the stock limit; zero or less removes the line. */
  setQuantity: (inventoryItemId: string, quantity: number) => void
  removeItem: (inventoryItemId: string) => void
  setLineDiscount: (inventoryItemId: string, discount: number) => void
  setBillDiscount: (discount: BillDiscount) => void
  setCustomer: (customerId: string | null) => void
  setPaymentMethod: (method: PaymentMethod) => void
  clear: () => void
}

const emptyCart = () => ({
  lines: [] as CartLine[],
  customerId: null,
  paymentMethod: 'Cash' as PaymentMethod,
  billDiscount: { kind: 'amount', value: 0 } as BillDiscount,
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
        discount: 0,
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

  setLineDiscount: (inventoryItemId, discount) =>
    set({
      lines: get().lines.map((line) =>
        line.inventoryItemId === inventoryItemId
          ? { ...line, discount: Number.isFinite(discount) ? Math.max(0, discount) : 0 }
          : line,
      ),
    }),

  setBillDiscount: (billDiscount) =>
    set({
      billDiscount: {
        kind: billDiscount.kind,
        value: Number.isFinite(billDiscount.value) ? Math.max(0, billDiscount.value) : 0,
      },
    }),

  setCustomer: (customerId) => set({ customerId }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  clear: () => set(emptyCart()),
}))

/**
 * What the till shows before the sale. The amounts on the saved bill come from the backend,
 * which does the same arithmetic (features/shop/pricing.ts).
 */
export function cartTotals(lines: CartLine[], billDiscount: BillDiscount, vat: VatSettings) {
  return {
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    ...billTotals(lines, billDiscount, vat),
  }
}
