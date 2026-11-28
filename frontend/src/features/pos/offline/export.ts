import i18n from '@/i18n'
import { type CsvColumn, datedFilename, downloadCsv } from '@/lib/export-csv'
import { formatDateTime } from '@/lib/format'
import type { QueuedOrder } from './db'
import { refusalOf } from './db'

// A copy of the unsent sales outside the browser, for the case where the queue itself is lost
// (cleared site data, a broken device). One row per line of a bill, readable in a spreadsheet,
// so the sales can be keyed in again by hand.

/** A sale waiting longer than this is called out: something is keeping it from being sent. */
export const STALE_AFTER_HOURS = 24

export function isStale(order: QueuedOrder, now = Date.now()): boolean {
  return now - Date.parse(order.createdAt) > STALE_AFTER_HOURS * 3_600_000
}

interface QueueRow {
  order: QueuedOrder
  line: QueuedOrder['summary']['lines'][number]
}

export function queueRows(orders: readonly QueuedOrder[]): QueueRow[] {
  return orders.flatMap((order) => order.summary.lines.map((line) => ({ order, line })))
}

export function queueColumns(): CsvColumn<QueueRow>[] {
  const t = i18n.t.bind(i18n)
  return [
    { header: t('offline.export.time'), value: ({ order }) => formatDateTime(order.createdAt) },
    { header: t('offline.export.reference'), value: ({ order }) => order.clientOrderId },
    {
      header: t('offline.export.status'),
      value: ({ order }) => t(order.status === 'pending' ? 'offline.pending' : 'offline.refused'),
    },
    { header: t('offline.export.item'), value: ({ line }) => line.name },
    { header: t('offline.export.quantity'), value: ({ line }) => line.quantity },
    { header: t('offline.export.unitPrice'), value: ({ line }) => line.unitPrice },
    { header: t('offline.export.billTotal'), value: ({ order }) => order.summary.total },
    {
      header: t('offline.export.payment'),
      value: ({ order }) => t(`payment.${order.request.paymentMethod}`),
    },
    { header: t('offline.export.reason'), value: ({ order }) => refusalOf(order) },
  ]
}

export function exportQueue(orders: readonly QueuedOrder[]) {
  downloadCsv(datedFilename('offline-sales'), queueRows(orders), queueColumns())
}
