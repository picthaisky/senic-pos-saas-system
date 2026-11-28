import type { Order } from '@/features/pos/types'
import type { ShopSettings } from '@/features/shop/api'
import i18n from '@/i18n'

// The printed receipt. It is a receipt (ใบเสร็จรับเงิน), not a tax invoice: issuing tax
// invoices from a till needs the Revenue Department's approval and numbered documents, which
// the system does not have. A shop that is not registered for VAT must not show any VAT on
// its receipts, so the tax lines appear only for a bill made with VAT.
//
// Always in Thai, whatever language the cashier's screen is in: it is the shop's document.

const money = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

interface ReceiptProps {
  order: Order
  shop: ShopSettings
}

export function Receipt({ order, shop }: ReceiptProps) {
  const t = i18n.getFixedT('th')
  const lineDiscounts = order.items.reduce((sum, line) => sum + line.discount, 0)
  const withVat = order.vatMode !== 'None'

  return (
    <article className="receipt" lang="th">
      <header className="receipt-center">
        {shop.shopName && <p className="receipt-shop">{shop.shopName}</p>}
        {shop.address && <p>{shop.address}</p>}
        {shop.phone && <p>{t('receipt.phone', { phone: shop.phone })}</p>}
        {/* The taxpayer number belongs to a VAT bill; a shop without VAT need not print it. */}
        {withVat && shop.taxId && (
          <p>
            {t('receipt.taxId', { taxId: shop.taxId })}
            {shop.branch && ` (${shop.branch})`}
          </p>
        )}
        <h1 className="receipt-title">{t('receipt.title')}</h1>
        {order.status === 'Cancelled' && <p className="receipt-void">{t('receipt.cancelled')}</p>}
      </header>

      <dl className="receipt-rows">
        <div>
          <dt>{t('receipt.number')}</dt>
          <dd>{order.orderNumber}</dd>
        </div>
        <div>
          <dt>{t('receipt.date')}</dt>
          <dd>{dateTime.format(new Date(order.createdAt))}</dd>
        </div>
        {order.customerName && (
          <div>
            <dt>{t('receipt.customer')}</dt>
            <dd>{order.customerName}</dd>
          </div>
        )}
      </dl>

      <table className="receipt-items">
        <thead>
          <tr>
            <th scope="col">{t('receipt.item')}</th>
            <th scope="col">{t('receipt.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((line) => (
            <tr key={line.id}>
              <th scope="row">
                {line.itemName}
                <span>
                  {line.quantity} × {money.format(line.unitPrice)}
                  {line.discount > 0 &&
                    ` ${t('receipt.lineDiscount', { amount: money.format(line.discount) })}`}
                </span>
              </th>
              <td>{money.format(line.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="receipt-rows">
        <div>
          <dt>{t('receipt.itemsTotal')}</dt>
          <dd>{money.format(order.totalAmount)}</dd>
        </div>
        {order.discountAmount > 0 && (
          <div>
            <dt>{t('receipt.billDiscount')}</dt>
            <dd>-{money.format(order.discountAmount)}</dd>
          </div>
        )}
        {order.pointsRedeemed > 0 && (
          <div>
            <dt>{t('receipt.pointsDiscount', { points: order.pointsRedeemed })}</dt>
            <dd>-{money.format(order.pointsDiscount)}</dd>
          </div>
        )}
        {order.vatMode === 'Exclusive' && (
          <div>
            <dt>{t('receipt.vatAdded', { rate: order.vatRatePercent })}</dt>
            <dd>{money.format(order.taxAmount)}</dd>
          </div>
        )}
        <div className="receipt-total">
          <dt>{t('receipt.total')}</dt>
          <dd>{money.format(order.netAmount)}</dd>
        </div>
        {order.vatMode === 'Inclusive' && (
          <div>
            <dt>{t('receipt.vatIncluded', { rate: order.vatRatePercent })}</dt>
            <dd>{money.format(order.taxAmount)}</dd>
          </div>
        )}
        <div>
          <dt>{t('receipt.paidBy')}</dt>
          <dd>{t(`payment.${order.paymentMethod}`)}</dd>
        </div>
        {lineDiscounts + order.discountAmount + order.pointsDiscount > 0 && (
          <div>
            <dt>{t('receipt.saved')}</dt>
            <dd>{money.format(lineDiscounts + order.discountAmount + order.pointsDiscount)}</dd>
          </div>
        )}
        {order.pointsEarned > 0 && (
          <div>
            <dt>{t('receipt.points')}</dt>
            <dd>+{order.pointsEarned}</dd>
          </div>
        )}
      </dl>

      <footer className="receipt-center">
        {withVat && <p>{t('receipt.notTaxInvoice')}</p>}
        {shop.receiptFooter && <p>{shop.receiptFooter}</p>}
      </footer>
    </article>
  )
}
