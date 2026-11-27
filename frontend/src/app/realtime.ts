import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import { refreshSession } from '@/lib/api'
import { env } from '@/lib/env'
import { formatNumber } from '@/lib/format'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'

// Live notifications from the backend hub (docs/API_REFERENCE.md §8). The server decides who
// receives what: sales go to roles that may see sales figures, stock alerts to stock managers.

const HUB_URL = '/hubs/notifications'

export interface LowStockEvent {
  inventoryItemId: string
  name: string
  quantity: number
  minimumStock: number
}

/** A sale was recorded somewhere in the shop: the figures on screen are out of date. */
export function onOrderCreated() {
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })
  void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
}

/** An item just reached its reorder point. `message` is the already-translated alert text. */
export function onLowStock(message: string) {
  toast.info(message)
  void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
}

/**
 * Mounted once while someone is signed in. Keeps a hub connection open and reconnects by
 * itself after network drops. There is no hub in mock mode or under test, so it does nothing there.
 */
export function useRealtime() {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.id)
  const online = useNetworkStore((state) => state.online)

  useEffect(() => {
    if (!userId || !online || env.useMocks || env.isTest) return

    let cancelled = false
    let stop = () => {}

    // The SignalR client is loaded on demand so it stays out of the initial bundle.
    void import('@microsoft/signalr').then(({ HubConnectionBuilder, LogLevel }) => {
      if (cancelled) return

      const connection = new HubConnectionBuilder()
        .withUrl(HUB_URL, {
          // Called for every (re)connect. A connection can outlive its access token, so a
          // token that is missing or about to expire is replaced first.
          accessTokenFactory: async () => {
            const { accessToken, accessTokenExpiresAt } = useAuthStore.getState()
            const expiring =
              accessTokenExpiresAt !== null && accessTokenExpiresAt - Date.now() < 30_000
            if (!accessToken || expiring) await refreshSession().catch(() => {})
            return useAuthStore.getState().accessToken ?? ''
          },
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build()

      connection.on('OrderCreated', onOrderCreated)
      connection.on('LowStock', (event: LowStockEvent) =>
        onLowStock(
          t('realtime.lowStock', { name: event.name, quantity: formatNumber(event.quantity) }),
        ),
      )
      // Events may have been missed while disconnected, so refetch once the link is back.
      connection.onreconnected(onOrderCreated)

      stop = () => void connection.stop()
      connection.start().catch(() => {
        // Live updates are a convenience: the app works without them, and the effect runs
        // again (and retries) when the network state changes.
      })
    })

    return () => {
      cancelled = true
      stop()
    }
  }, [userId, online, t])
}
