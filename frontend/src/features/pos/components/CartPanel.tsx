import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CloudOff, CreditCard, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, ConfirmDialog, Input, Modal, Select } from '@/components/ui'
import { CUSTOMERS_KEY, useCustomers } from '@/features/customers/api'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import { PrintReceiptButton } from '@/features/receipt/print'
import { DEFAULT_SHOP_SETTINGS, useShopSettings } from '@/features/shop/api'
import {
  lineDiscountOf,
  lineSubtotal,
  maxRedeemablePoints,
  pointsDiscountOf,
  pointsFor,
  type VatMode,
} from '@/features/shop/pricing'
import { errorMessage, isNetworkError } from '@/lib/api'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'
import { ordersApi } from '../api'
import { cartTotals, useCartStore } from '../cart-store'
import { type SaleResult, submitSale } from '../offline/queue'
import { PAYMENT_METHODS, type PaymentMethod } from '../types'

/** The wording of the VAT line: added on top, contained in the price, or absent. */
function useTaxLabel() {
  const { t } = useTranslation()
  return (vatMode: VatMode, rate: number) =>
    vatMode === 'Exclusive'
      ? t('pos.tax', { rate })
      : vatMode === 'Inclusive'
        ? t('pos.taxIncluded', { rate })
        : null
}

/** Text of a money field: empty for zero, so the placeholder shows. */
const amountText = (value: number) => (value > 0 ? String(value) : '')

export function CartPanel() {
  const { t } = useTranslation()
  const taxLabel = useTaxLabel()
  // The copy kept on the device answers while offline; a device that never saw the settings
  // prices like a shop without VAT, and the server works out the real bill when it gets it.
  const shop = useShopSettings().data ?? DEFAULT_SHOP_SETTINGS
  const cart = useCartStore()
  const customers = useCustomers()
  const queryClient = useQueryClient()
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [receipt, setReceipt] = useState<SaleResult | null>(null)

  const online = useNetworkStore((state) => state.online)

  // Points as a discount: only for a chosen customer with points, in a shop that has set what
  // a point is worth, and only while online, because the balance on this device may be stale.
  const customer = customers.data?.find((candidate) => candidate.id === cart.customerId)
  const canUsePoints = shop.pointValueBaht > 0 && !!customer && customer.loyaltyPoints > 0
  const beforePoints = cartTotals(cart.lines, cart.billDiscount, shop)
  const maxPoints =
    canUsePoints && online
      ? maxRedeemablePoints(
          beforePoints.itemsTotal - beforePoints.billDiscount,
          shop.pointValueBaht,
          customer.loyaltyPoints,
        )
      : 0
  const pointsUsed = Math.min(cart.pointsToRedeem, maxPoints)

  const totals = cartTotals(
    cart.lines,
    cart.billDiscount,
    shop,
    pointsDiscountOf(pointsUsed, shop.pointValueBaht),
  )
  const customerPoints = cart.customerId ? pointsFor(totals.total, shop.bahtPerPoint) : 0
  const isEmpty = cart.lines.length === 0

  const sale = useMutation({
    // Must run while the browser is offline too: that is when the sale gets queued.
    networkMode: 'always',
    mutationFn: async (): Promise<SaleResult> => {
      const request = {
        customerId: cart.customerId,
        paymentMethod: cart.paymentMethod,
        discountAmount: totals.billDiscount,
        pointsRedeemed: pointsUsed,
        notes: null,
        clientOrderId: cart.clientOrderId,
        items: cart.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          discount: lineDiscountOf(line),
        })),
      }
      // A bill that spends points is never kept on the device for later: only the server knows
      // the balance, and it could refuse the bill after the customer has left.
      if (pointsUsed > 0) return { kind: 'sent', order: await ordersApi.create(request) }
      return submitSale(request, {
        lines: cart.lines.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice })),
        total: totals.total,
      })
    },
    onSuccess: (result) => {
      cart.clear()
      setReceipt(result)
      if (result.kind === 'sent') {
        // A sale changes stock levels and the dashboard figures.
        void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
        void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })
        // And the customer's points, earned or used.
        if (result.order.customerId) void queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY })
      }
    },
    // The cart (and its clientOrderId) is kept, so trying again cannot create a duplicate.
    // Only a bill with points can fail for lack of a connection: the others are queued.
    onError: (error) =>
      toast.error(
        isNetworkError(error)
          ? t('pos.pointsNeedServer')
          : errorMessage(error, t('pos.checkoutFailed')),
      ),
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
                    <p className="font-semibold">{formatCurrency(lineSubtotal(line))}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-2">
                  <label
                    htmlFor={`discount-${line.inventoryItemId}`}
                    className="text-xs text-muted"
                  >
                    {t('pos.lineDiscount')}
                  </label>
                  <input
                    id={`discount-${line.inventoryItemId}`}
                    aria-label={t('pos.lineDiscountNamed', { name: line.name })}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={line.unitPrice * line.quantity}
                    step="0.01"
                    placeholder="0"
                    value={amountText(line.discount)}
                    onChange={(event) =>
                      cart.setLineDiscount(line.inventoryItemId, event.target.valueAsNumber)
                    }
                    className="h-8 w-24 rounded-lg border border-border bg-surface px-2 text-right text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-primary"
                  />
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
            <dd>{formatCurrency(totals.gross)}</dd>
          </div>
          {totals.lineDiscounts + totals.billDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">{t('pos.discount')}</dt>
              <dd>-{formatCurrency(totals.lineDiscounts + totals.billDiscount)}</dd>
            </div>
          )}
          {totals.pointsDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">
                {t('pos.pointsDiscount', { points: formatNumber(pointsUsed) })}
              </dt>
              <dd>-{formatCurrency(totals.pointsDiscount)}</dd>
            </div>
          )}
          {shop.vatMode === 'Exclusive' && (
            <div className="flex justify-between">
              <dt className="text-muted">{taxLabel(shop.vatMode, shop.vatRatePercent)}</dt>
              <dd>{formatCurrency(totals.tax)}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-border pt-2 text-xl font-semibold">
            <dt>{t('pos.total')}</dt>
            <dd>{formatCurrency(totals.total)}</dd>
          </div>
          {shop.vatMode === 'Inclusive' && (
            <div className="flex justify-between text-muted">
              <dt>{taxLabel(shop.vatMode, shop.vatRatePercent)}</dt>
              <dd>{formatCurrency(totals.tax)}</dd>
            </div>
          )}
          {customerPoints > 0 && (
            <div className="flex justify-between text-muted">
              <dt>{t('pos.pointsToEarn')}</dt>
              <dd>+{customerPoints}</dd>
            </div>
          )}
        </dl>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Input
            label={t('pos.billDiscount')}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0"
            disabled={isEmpty}
            value={amountText(cart.billDiscount.value)}
            onChange={(event) =>
              cart.setBillDiscount({ ...cart.billDiscount, value: event.target.valueAsNumber })
            }
          />
          <Select
            label={t('pos.billDiscountKind')}
            disabled={isEmpty}
            value={cart.billDiscount.kind}
            onChange={(event) =>
              cart.setBillDiscount({
                ...cart.billDiscount,
                kind: event.target.value as 'amount' | 'percent',
              })
            }
          >
            <option value="amount">฿</option>
            <option value="percent">%</option>
          </Select>
        </div>

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

        {canUsePoints && (
          <Input
            label={t('pos.usePoints')}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxPoints}
            step={1}
            placeholder="0"
            disabled={isEmpty || maxPoints === 0}
            hint={
              online
                ? t('pos.usePointsHint', {
                    balance: formatNumber(customer.loyaltyPoints),
                    max: formatNumber(maxPoints),
                    value: formatCurrency(shop.pointValueBaht),
                  })
                : t('pos.usePointsOffline')
            }
            value={amountText(pointsUsed)}
            onChange={(event) =>
              cart.setPointsToRedeem(Math.min(event.target.valueAsNumber, maxPoints))
            }
          />
        )}

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
        footer={
          <>
            {/* A sale kept on the device has no bill number yet, so nothing to print. */}
            {receipt?.kind === 'sent' && <PrintReceiptButton order={receipt.order} />}
            <Button onClick={() => setReceipt(null)}>{t('pos.newSale')}</Button>
          </>
        }
      >
        {receipt?.kind === 'sent' && (
          <dl className="grid grid-cols-2 gap-y-2 tabular-nums">
            <dt className="text-muted">{t('pos.orderNumber')}</dt>
            <dd className="text-right font-medium">{receipt.order.orderNumber}</dd>
            <dt className="text-muted">{t('pos.paymentMethod')}</dt>
            <dd className="text-right">{t(`payment.${receipt.order.paymentMethod}`)}</dd>
            {receipt.order.discountAmount > 0 && (
              <>
                <dt className="text-muted">{t('pos.billDiscount')}</dt>
                <dd className="text-right">-{formatCurrency(receipt.order.discountAmount)}</dd>
              </>
            )}
            {receipt.order.pointsRedeemed > 0 && (
              <>
                <dt className="text-muted">
                  {t('pos.pointsDiscount', { points: formatNumber(receipt.order.pointsRedeemed) })}
                </dt>
                <dd className="text-right">-{formatCurrency(receipt.order.pointsDiscount)}</dd>
              </>
            )}
            {receipt.order.vatMode !== 'None' && (
              <>
                <dt className="text-muted">
                  {taxLabel(receipt.order.vatMode, receipt.order.vatRatePercent)}
                </dt>
                <dd className="text-right">{formatCurrency(receipt.order.taxAmount)}</dd>
              </>
            )}
            {receipt.order.pointsEarned > 0 && (
              <>
                <dt className="text-muted">{t('pos.pointsEarned')}</dt>
                <dd className="text-right">+{receipt.order.pointsEarned}</dd>
              </>
            )}
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
