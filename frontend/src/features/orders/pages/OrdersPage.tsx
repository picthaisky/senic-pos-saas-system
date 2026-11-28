import { Ban, Download, Eye } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  type Column,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Select,
} from '@/components/ui'
import type { Order, OrderStatus } from '@/features/pos/types'
import { errorMessage } from '@/lib/api'
import { type CsvColumn, datedFilename, downloadCsv } from '@/lib/export-csv'
import { formatCurrency, formatDateTime, formatNumber, toIsoDate } from '@/lib/format'
import { hasAnyRole, useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import { useCancelOrder, useOrders } from '../api'
import { OrderDetailModal } from '../components/OrderDetailModal'
import { OrderStatusBadge } from '../components/OrderStatusBadge'

/** What the till can produce today; the API knows more statuses, shown if they ever appear. */
const STATUS_FILTERS: readonly OrderStatus[] = ['Completed', 'Cancelled']

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toIsoDate(date)
}

export function OrdersPage() {
  const { t } = useTranslation()
  // Same rule as the API: only managers cancel bills; a viewer reads.
  const canCancel = useAuthStore((state) => hasAnyRole(state.user, ['Admin', 'Owner']))

  const [from, setFrom] = useState(() => daysAgo(6))
  const [to, setTo] = useState(() => daysAgo(0))
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<Order | null>(null)

  // An emptied or reversed range is not sent: the last good list stays on screen.
  const reversed = from !== '' && to !== '' && from > to
  const validRange = from !== '' && to !== '' && !reversed
  const orders = useOrders({ from, to, status: status || undefined }, validRange)
  const cancel = useCancelOrder()

  const all = orders.data ?? []
  const lastPage = Math.max(0, Math.ceil(all.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const rows = all.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  // Looked up in the fresh list, so the open bill shows its new status after a cancellation.
  const viewing = all.find((order) => order.id === viewingId)

  const completed = all.filter((order) => order.status === 'Completed')
  const completedTotal = completed.reduce((sum, order) => sum + order.netAmount, 0)

  function confirmCancel() {
    if (!cancelling) return
    cancel.mutate(cancelling.id, {
      onSuccess: () => {
        toast.success(t('orders.cancelled', { number: cancelling.orderNumber }))
        setCancelling(null)
      },
      onError: (error) => {
        toast.error(errorMessage(error, t('common.error')))
        setCancelling(null)
      },
    })
  }

  /** Exports every bill matching the filters, not just the visible page. */
  function exportCsv() {
    const columns: CsvColumn<Order>[] = [
      { header: t('orders.time'), value: (order) => formatDateTime(order.createdAt) },
      { header: t('pos.orderNumber'), value: (order) => order.orderNumber },
      { header: t('orders.customer'), value: (order) => order.customerName || t('pos.walkIn') },
      {
        header: t('orders.items'),
        value: (order) =>
          order.items.map((line) => `${line.itemName} × ${line.quantity}`).join('; '),
      },
      { header: t('orders.payment'), value: (order) => t(`payment.${order.paymentMethod}`) },
      { header: t('pos.subtotal'), value: (order) => order.totalAmount },
      { header: t('orders.discount'), value: (order) => order.discountAmount },
      { header: t('orders.tax'), value: (order) => order.taxAmount },
      { header: t('pos.total'), value: (order) => order.netAmount },
      { header: t('orders.status'), value: (order) => t(`orders.statuses.${order.status}`) },
    ]
    downloadCsv(datedFilename('orders'), all, columns)
  }

  const columns: Column<Order>[] = [
    {
      key: 'time',
      header: t('orders.time'),
      cell: (order) => <span className="whitespace-nowrap">{formatDateTime(order.createdAt)}</span>,
    },
    {
      key: 'number',
      header: t('pos.orderNumber'),
      cell: (order) => <span className="font-medium">{order.orderNumber}</span>,
    },
    {
      key: 'customer',
      header: t('orders.customer'),
      cell: (order) => order.customerName || <span className="text-muted">{t('pos.walkIn')}</span>,
    },
    {
      key: 'payment',
      header: t('orders.payment'),
      cell: (order) => t(`payment.${order.paymentMethod}`),
    },
    {
      key: 'total',
      header: t('pos.total'),
      align: 'right',
      cell: (order) => (
        <span
          className={
            order.status === 'Cancelled' ? 'text-muted tabular-nums line-through' : 'tabular-nums'
          }
        >
          {formatCurrency(order.netAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('orders.status'),
      cell: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (order) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('orders.viewNamed', { number: order.orderNumber })}
            title={t('orders.view')}
            onClick={() => setViewingId(order.id)}
          >
            <Eye className="size-4" />
          </Button>
          {canCancel && order.status !== 'Cancelled' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-danger"
              aria-label={t('orders.cancelNamed', { number: order.orderNumber })}
              title={t('orders.cancelOrder')}
              onClick={() => setCancelling(order)}
            >
              <Ban className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('nav.orders')}
        actions={
          <Button variant="secondary" disabled={all.length === 0} onClick={exportCsv}>
            <Download className="size-5" />
            {t('common.exportCsv')}
          </Button>
        }
      />

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
          <Input
            label={t('orders.from')}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(0)
            }}
          />
          <Input
            label={t('orders.to')}
            type="date"
            value={to}
            min={from || undefined}
            error={reversed ? t('orders.rangeInvalid') : undefined}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(0)
            }}
          />
          <Select
            label={t('orders.status')}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | '')
              setPage(0)
            }}
          >
            <option value="">{t('orders.allStatuses')}</option>
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`orders.statuses.${value}`)}
              </option>
            ))}
          </Select>
        </div>

        {orders.isError ? (
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void orders.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : (
          <>
            {orders.data && (
              <p className="mb-3 text-sm text-muted">
                {t('orders.summary', {
                  count: completed.length,
                  bills: formatNumber(completed.length),
                  total: formatCurrency(completedTotal),
                })}
              </p>
            )}
            <DataTable
              caption={t('nav.orders')}
              columns={columns}
              rows={rows}
              rowKey={(order) => order.id}
              loading={orders.isPending}
              empty={t('orders.empty')}
            />
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={all.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(0)
              }}
            />
          </>
        )}
      </Card>

      {viewing && (
        <OrderDetailModal
          order={viewing}
          onClose={() => setViewingId(null)}
          onCancelOrder={
            canCancel && viewing.status !== 'Cancelled' ? () => setCancelling(viewing) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!cancelling}
        title={t('orders.cancelOrder')}
        confirmLabel={t('orders.cancelOrder')}
        danger
        loading={cancel.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
      >
        {t('orders.cancelConfirm', {
          number: cancelling?.orderNumber,
          total: formatCurrency(cancelling?.netAmount ?? 0),
        })}
      </ConfirmDialog>
    </>
  )
}
