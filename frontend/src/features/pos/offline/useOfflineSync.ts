import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'
import { isStale } from './export'
import { loadQueue, syncQueue, useOrderQueue } from './queue'
import { protectStorage } from './storage'

/**
 * Mounted once for the whole app. Loads the signed-in tenant's queued sales and sends them
 * whenever that becomes possible: at sign-in, at startup, and each time the network returns.
 */
export function useOfflineSync() {
  const { t } = useTranslation()
  const tenantId = useAuthStore((state) => state.user?.tenantId)
  const online = useNetworkStore((state) => state.online)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await loadQueue()
      if (!tenantId) return
      if (useOrderQueue.getState().orders.length > 0) void protectStorage()
      const { sent, failed } = online ? await syncQueue() : { sent: 0, failed: 0 }
      if (cancelled) return
      if (sent > 0) toast.success(t('offline.synced', { count: sent }))
      if (failed > 0) toast.error(t('offline.syncRefused', { count: failed }))
      // Still here after a day: nobody may have noticed. Said once per sign-in or reconnect.
      const stale = useOrderQueue.getState().orders.filter((order) => isStale(order)).length
      if (stale > 0) toast.error(t('offline.staleToast', { count: stale }))
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, online, t])
}
