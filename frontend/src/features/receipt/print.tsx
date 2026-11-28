import { Printer } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import type { Order } from '@/features/pos/types'
import { DEFAULT_SHOP_SETTINGS, useShopSettings } from '@/features/shop/api'
import { printReceipt, usePrintJob } from './print-job'
import { Receipt } from './Receipt'

// Printing goes through the browser's own print dialog, which also offers "Save as PDF".
// The receipt is rendered next to the app, outside #root; the print stylesheet
// (styles/index.css) hides the app and shows only the receipt.

/** Mounted once, in the app layout. Renders the receipt being printed, if any. */
export function ReceiptPrintHost() {
  const order = usePrintJob((state) => state.order)
  const shop = useShopSettings().data ?? DEFAULT_SHOP_SETTINGS

  useEffect(() => {
    if (!order) return
    const done = () => usePrintJob.setState({ order: null })
    window.addEventListener('afterprint', done, { once: true })
    // The receipt is in the document by now: effects run after the commit.
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [order])

  return order
    ? createPortal(
        <div className="receipt-print">
          <Receipt order={order} shop={shop} />
        </div>,
        document.body,
      )
    : null
}

export function PrintReceiptButton({ order }: { order: Order }) {
  const { t } = useTranslation()
  return (
    <Button variant="secondary" onClick={() => printReceipt(order)}>
      <Printer className="size-5" />
      {t('receipt.print')}
    </Button>
  )
}
