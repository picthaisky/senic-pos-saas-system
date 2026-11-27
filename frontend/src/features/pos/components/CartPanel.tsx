import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CloudOff, CreditCard, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ConfirmDialog, Modal, Select } from '@/components/ui'
import { useCustomers } from '@/features/customers/api'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import { errorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/stores/toast'
import { cartTotals, TAX_RATE, useCartStore } from '../cart-store'
import { type SaleResult, submitSale } from '../offline/queue'
import { PAYMENT_METHODS, type PaymentMethod } from '../types'

export function CartPanel() {
  const { t } = useTranslation()
  const cart = useCartStore()
  const customers = useCustomers()
  const queryClient = useQueryClient()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [receipt, setReceipt] = useState<SaleResult | null>(null)

  const totals = cartTotals(cart.lines)
  const isEmpty = cart.lines.length === 0

  const sale = useMutation({
    // Must run while the browser is offline too: that is when the sale gets queued.
    networkMode: 'always',
    mutationFn: () =>
      submitSale(
        {
          customerId: cart.customerId,
          paymentMethod: cart.paymentMethod,
          discountAmount: 0,
          notes: null,
          clientOrderId: cart.clientOrderId,
          items: cart.lines.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity,
            discount: 0,
          })),
        },
        {
          lines: cart.lines.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
          total: totals.total,
        },
      ),
    onSuccess: (result) => {
      cart.clear()
      setReceipt(result)
      if (result.kind === 'sent') {
        // A sale changes stock levels and the dashboard figures.
        void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })
      }
    },
    // The cart (and its clientOrderId) is kept, so trying again cannot create a duplicate.
    onError: (error) => toast.error(errorMessage(error, t('pos.checkoutFailed'))),
  })

  return (
    <section
      aria-label={t('pos.cart')}
      className="flex min-h-0 flex-col rounded-xl border border-border bg-surface shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold">{t('pos.cart')}</h2>
        <span
          aria-label={t('pos.itemCount', { count: totals.itemCount })}
          className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-sm font-semibold text-primary-fg tabular-nums"
        >
          {totals.itemCount}
        </span>
      </header>

      <div className="min-h-32 flex-1 overflow-y-auto px-5">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-muted">
            <ShoppingCart className="size-12" aria-hidden="true" />
            <p>{t('pos.emptyCart')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {cart.lines.map((line) => (
              <li key={line.inventoryItemId} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{line.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-mt-1 size-8 text-danger"
                    aria-label={t('pos.removeNamed', { name: line.name })}
                    onClick={() => cart.removeItem(line.inventoryItemId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8"
                      aria-label={t('pos.decreaseNamed', { name: line.name })}
                      onClick={() => cart.setQuantity(line.inventoryItemId, line.quantity - 1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-10 text-center font-semibold tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8"
                      aria-label={t('pos.increaseNamed', { name: line.name })}
                      disabled={line.quantity >= line.available}
                      onClick={() => cart.setQuantity(line.inventoryItemId, line.quantity + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-xs text-muted">
                      {t('pos.each', { price: formatCurrency(line.unitPrice) })}
                    </p>
                    <p className="font-semibold">
                      {formatCurrency(line.unitPrice * line.quantity)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-5">
        <dl className="flex flex-col gap-1 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted">{t('pos.subtotal')}</dt>
            <dd>{formatCurrency(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t('pos.tax', { rate: TAX_RATE * 100 })}</dt>
            <dd>{formatCurrency(totals.tax)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-xl font-semibold">
            <dt>{t('pos.total')}</dt>
            <dd>{formatCurrency(totals.total)}</dd>
          </div>
        </dl>

        <Select
          label={t('pos.customer')}
          value={cart.customerId ?? ''}
          onChange={(event) => cart.setCustomer(event.target.value || null)}
        >
          <option value="">{t('pos.walkIn')}</option>
          {customers.data?.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullName}
            </option>
          ))}
        </Select>

        <Select
          label={t('pos.paymentMethod')}
          value={cart.paymentMethod}
          onChange={(event) => cart.setPaymentMethod(event.target.value as PaymentMethod)}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {t(`payment.${method}`)}
            </option>
          ))}
        </Select>

        <Button
          className="h-12 text-lg"
          disabled={isEmpty}
          loading={sale.isPending}
          onClick={() => sale.mutate()}
        >
          {!sale.isPending && <CreditCard className="size-5" />}
          {t('pos.checkout')}
        </Button>
        <Button variant="secondary" disabled={isEmpty} onClick={() => setConfirmingClear(true)}>
          {t('pos.clearCart')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingClear}
        title={t('pos.clearCart')}
        confirmLabel={t('pos.clearCart')}
        danger
        onConfirm={() => {
          cart.clear()
          setConfirmingClear(false)
        }}
        onCancel={() => setConfirmingClear(false)}
      >
        {t('pos.clearConfirm')}
      </ConfirmDialog>

      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title={receipt?.kind === 'queued' ? t('offline.savedTitle') : t('pos.orderCreated')}
        footer={<Button onClick={() => setReceipt(null)}>{t('pos.newSale')}</Button>}
      >
        {receipt?.kind === 'sent' && (
          <dl className="grid grid-cols-2 gap-y-2 tabular-nums">
            <dt className="text-muted">{t('pos.orderNumber')}</dt>
            <dd className="text-right font-medium">{receipt.order.orderNumber}</dd>
            <dt className="text-muted">{t('pos.paymentMethod')}</dt>
            <dd className="text-right">{t(`payment.${receipt.order.paymentMethod}`)}</dd>
            <dt className="text-muted">{t('pos.tax', { rate: TAX_RATE * 100 })}</dt>
            <dd className="text-right">{formatCurrency(receipt.order.taxAmount)}</dd>
            <dt className="text-lg font-semibold">{t('pos.total')}</dt>
            <dd className="text-right text-lg font-semibold">
              {formatCurrency(receipt.order.netAmount)}
            </dd>
          </dl>
        )}
        {receipt?.kind === 'queued' && (
          <div className="flex flex-col gap-3">
            <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
              <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              {t('offline.savedMessage')}
            </p>
            <dl className="grid grid-cols-2 gap-y-2 tabular-nums">
              <dt className="text-muted">{t('pos.paymentMethod')}</dt>
              <dd className="text-right">{t(`payment.${receipt.queued.request.paymentMethod}`)}</dd>
              <dt className="text-lg font-semibold">{t('offline.estimatedTotal')}</dt>
              <dd className="text-right text-lg font-semibold">
                {formatCurrency(receipt.queued.summary.total)}
              </dd>
            </dl>
          </div>
        )}
      </Modal>
    </section>
  )
}
