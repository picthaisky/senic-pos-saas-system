import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'
import { loadQueue, syncQueue } from './queue'

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
      if (!tenantId || !online) return
      const { sent, failed } = await syncQueue()
      if (cancelled) return
      if (sent > 0) toast.success(t('offline.synced', { count: sent }))
      if (failed > 0) toast.error(t('offline.syncRefused', { count: failed }))
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, online, t])
}
