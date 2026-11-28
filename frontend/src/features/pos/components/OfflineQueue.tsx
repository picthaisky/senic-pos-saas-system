import { CloudUpload, Download, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, ConfirmDialog, Modal } from '@/components/ui'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'
import type { QueuedOrder } from '../offline/db'
import { exportQueue, isStale, STALE_AFTER_HOURS } from '../offline/export'
import {
  discardOrder,
  retryOrder,
  type SyncReport,
  syncQueue,
  useOrderQueue,
} from '../offline/queue'
import { useStorageProtection } from '../offline/storage'

/**
 * Topbar button showing how many sales are waiting to be sent. Hidden while the queue is
 * empty. Opens a list where the cashier can send them now, or retry / discard refused ones.
 */
export function OfflineQueueButton() {
  const { t } = useTranslation()
  const orders = useOrderQueue((state) => state.orders)
  const syncing = useOrderQueue((state) => state.syncing)
  const online = useNetworkStore((state) => state.online)
  const protection = useStorageProtection((state) => state.protection)
  const [open, setOpen] = useState(false)
  const [discarding, setDiscarding] = useState<QueuedOrder | null>(null)

  if (orders.length === 0 && !open) return null

  const hasFailed = orders.some((order) => order.status === 'failed')
  const hasPending = orders.some((order) => order.status === 'pending')
  const hasStale = orders.some((order) => isStale(order))

  function report({ sent, failed }: SyncReport) {
    if (sent > 0) toast.success(t('offline.synced', { count: sent }))
    if (failed > 0) toast.error(t('offline.syncRefused', { count: failed }))
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-10"
        onClick={() => setOpen(true)}
        aria-label={t('offline.queueButton', { count: orders.length })}
        title={t('offline.queueButton', { count: orders.length })}
      >
        {hasFailed || hasStale ? (
          <TriangleAlert className="size-5 text-danger" />
        ) : (
          <CloudUpload className="size-5 text-warning" />
        )}
        <span className="tabular-nums">{orders.length}</span>
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('offline.queueTitle')}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={orders.length === 0}
              onClick={() => exportQueue(orders)}
            >
              <Download className="size-5" />
              {t('offline.exportFile')}
            </Button>
            <Button
              disabled={!online || !hasPending}
              loading={syncing}
              onClick={() => void syncQueue().then(report)}
            >
              {!syncing && <CloudUpload className="size-5" />}
              {t('offline.syncNow')}
            </Button>
          </>
        }
      >
        {orders.length === 0 ? (
          <p className="py-6 text-center text-muted">{t('offline.queueEmpty')}</p>
        ) : (
          <>
            {!online && <p className="mb-3 text-sm text-muted">{t('offline.willSyncLater')}</p>}
            {(hasStale || protection === 'best-effort') && (
              <div
                role="alert"
                className="mb-3 flex flex-col gap-1 rounded-lg bg-warning/15 px-3 py-2 text-sm"
              >
                {hasStale && <p>{t('offline.staleWarning', { hours: STALE_AFTER_HOURS })}</p>}
                {protection === 'best-effort' && <p>{t('offline.notProtected')}</p>}
              </div>
            )}
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.clientOrderId} className="flex flex-col gap-1 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted">{formatDateTime(order.createdAt)}</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(order.summary.total)}
                    </span>
                  </div>
                  <p className="text-sm">
                    {order.summary.lines
                      .map((line) => `${line.name} × ${line.quantity}`)
                      .join(', ')}
                  </p>
                  {order.status === 'pending' ? (
                    <div>
                      <Badge tone="warning">{t('offline.pending')}</Badge>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge tone="danger">{t('offline.refused')}</Badge>
                        {order.error && <span className="text-sm text-danger">{order.error}</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!online || syncing}
                          onClick={() => void retryOrder(order).then(report)}
                        >
                          <RefreshCw className="size-4" />
                          {t('common.retry')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          onClick={() => setDiscarding(order)}
                        >
                          <Trash2 className="size-4" />
                          {t('offline.discard')}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!discarding}
        title={t('offline.discardTitle')}
        confirmLabel={t('offline.discard')}
        danger
        onConfirm={() => {
          if (discarding) void discardOrder(discarding.clientOrderId)
          setDiscarding(null)
        }}
        onCancel={() => setDiscarding(null)}
      >
        {t('offline.discardConfirm')}
      </ConfirmDialog>
    </>
  )
}
