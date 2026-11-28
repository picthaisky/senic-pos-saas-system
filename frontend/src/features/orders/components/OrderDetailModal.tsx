import { Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import type { Order } from '@/features/pos/types'
import { PrintReceiptButton } from '@/features/receipt/print'
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format'
import { OrderStatusBadge } from './OrderStatusBadge'

interface OrderDetailModalProps {
  order: Order
  onClose: () => void
  /** Absent when the user may not cancel bills, or this one is already cancelled. */
  onCancelOrder?: () => void
}

export function OrderDetailModal({ order, onClose, onCancelOrder }: OrderDetailModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      open
      onClose={onClose}
      title={order.orderNumber}
      footer={
        <>
          {onCancelOrder && (
            <Button variant="danger" onClick={onCancelOrder}>
              <Ban className="size-5" />
              {t('orders.cancelOrder')}
            </Button>
          )}
          <PrintReceiptButton order={order} />
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </>
      }
    >
      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t('orders.time')}</dt>
        <dd>{formatDateTime(order.createdAt)}</dd>
        <dt className="text-muted">{t('orders.customer')}</dt>
        <dd>{order.customerName || t('pos.walkIn')}</dd>
        <dt className="text-muted">{t('orders.payment')}</dt>
        <dd>{t(`payment.${order.paymentMethod}`)}</dd>
        <dt className="text-muted">{t('orders.status')}</dt>
        <dd>
          <OrderStatusBadge status={order.status} />
        </dd>
      </dl>

      <table className="w-full text-sm">
        <caption className="sr-only">{t('orders.items')}</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th scope="col" className="py-2 font-medium">
              {t('orders.item')}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t('orders.quantity')}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t('orders.unitPrice')}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t('orders.lineTotal')}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <th scope="row" className="py-2 text-left font-normal">
                {line.itemName}
              </th>
              <td className="py-2 text-right tabular-nums">{formatNumber(line.quantity)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
              <td className="py-2 text-right tabular-nums">
                {formatCurrency(line.subtotal)}
                {line.discount > 0 && (
                  <span className="block text-xs text-muted">
                    {t('orders.lineDiscount', { amount: formatCurrency(line.discount) })}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t('pos.subtotal')}</dt>
        <dd className="text-right tabular-nums">{formatCurrency(order.totalAmount)}</dd>
        {order.discountAmount > 0 && (
          <>
            <dt className="text-muted">{t('orders.discount')}</dt>
            <dd className="text-right tabular-nums">-{formatCurrency(order.discountAmount)}</dd>
          </>
        )}
        {order.vatMode === 'Exclusive' && (
          <>
            <dt className="text-muted">{t('pos.tax', { rate: order.vatRatePercent })}</dt>
            <dd className="text-right tabular-nums">{formatCurrency(order.taxAmount)}</dd>
          </>
        )}
        <dt className="text-base font-semibold">{t('pos.total')}</dt>
        <dd className="text-right text-base font-semibold tabular-nums">
          {formatCurrency(order.netAmount)}
        </dd>
        {order.vatMode === 'Inclusive' && (
          <>
            <dt className="text-muted">{t('pos.taxIncluded', { rate: order.vatRatePercent })}</dt>
            <dd className="text-right tabular-nums">{formatCurrency(order.taxAmount)}</dd>
          </>
        )}
        {order.pointsEarned > 0 && (
          <>
            <dt className="text-muted">{t('pos.pointsEarned')}</dt>
            <dd className="text-right tabular-nums">+{formatNumber(order.pointsEarned)}</dd>
          </>
        )}
      </dl>
    </Modal>
  )
}
