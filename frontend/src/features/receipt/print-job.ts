import { create } from 'zustand'
import type { Order } from '@/features/pos/types'

/** The bill whose receipt is being printed, if any (rendered by ReceiptPrintHost). */
export const usePrintJob = create<{ order: Order | null }>(() => ({ order: null }))

/** Opens the print dialog with this bill's receipt. */
export function printReceipt(order: Order) {
  usePrintJob.setState({ order })
}
