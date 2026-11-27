// Shapes from docs/API_REFERENCE.md §5.

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
  status: OrderStatus
  paymentMethod: PaymentMethod
  createdAt: string
  completedAt: string | null
  items: OrderItem[]
}
