// Shapes from docs/API_REFERENCE.md §5.

import type { VatMode } from '@/features/shop/pricing'

export const PAYMENT_METHODS = [
  'Cash',
  'CreditCard',
  'DebitCard',
  'QRCode',
  'BankTransfer',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type OrderStatus = 'Pending' | 'Processing' | 'Completed' | 'Cancelled' | 'Refunded'

export interface CreateOrder {
  /** null = walk-in customer. */
  customerId: string | null
  paymentMethod: PaymentMethod
  discountAmount: number
  /** Points of the customer used as a discount. Absent on sales queued by an older version. */
  pointsRedeemed?: number
  notes: string | null
  /** Generated per cart so a retried or re-synced order is not created twice. */
  clientOrderId: string
  items: { inventoryItemId: string; quantity: number; discount: number }[]
}

export interface OrderItem {
  id: string
  inventoryItemId: string
  itemName: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string | null
  customerName: string
  totalAmount: number
  discountAmount: number
  taxAmount: number
  netAmount: number
  /** How the shop's prices related to VAT when the bill was made. */
  vatMode: VatMode
  vatRatePercent: number
  /** Points this bill gave its customer. */
  pointsEarned: number
  /** Points the customer used on this bill, and the baht they took off. */
  pointsRedeemed: number
  pointsDiscount: number
  /** Name of the user who recorded the sale; null on bills made before it was kept. */
  soldByName: string | null
  status: OrderStatus
  paymentMethod: PaymentMethod
  createdAt: string
  completedAt: string | null
  items: OrderItem[]
}
