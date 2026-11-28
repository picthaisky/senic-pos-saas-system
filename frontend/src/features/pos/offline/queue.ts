import { create } from 'zustand'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import { errorMessage, getProblem, isNetworkError } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { ordersApi } from '../api'
import type { CreateOrder, Order } from '../types'
import { deductLocalStock, syncCatalog } from './catalog'
import { offlineDb, type QueuedOrder } from './db'
import { protectStorage } from './storage'

// Sales made while the server is unreachable are kept in IndexedDB and sent later. Sending is
// safe to repeat: every order carries a clientOrderId and the server ignores duplicates.

interface QueueState {
  /** Queued orders of the signed-in user's tenant, oldest first. */
  orders: QueuedOrder[]
  syncing: boolean
}

export const useOrderQueue = create<QueueState>(() => ({ orders: [], syncing: false }))

const tenantId = () => useAuthStore.getState().user?.tenantId

/** Reloads the list from IndexedDB for the current tenant. */
export async function loadQueue(): Promise<void> {
  const tenant = tenantId()
  useOrderQueue.setState({ orders: tenant ? await offlineDb.listOrders(tenant) : [] })
}

export type SaleResult = { kind: 'sent'; order: Order } | { kind: 'queued'; queued: QueuedOrder }

/**
 * Records a sale: sent to the server when it can be reached, otherwise queued on this device.
 * Rejects only when the server answered and refused the sale (e.g. not enough stock).
 */
export async function submitSale(
  request: CreateOrder,
  summary: QueuedOrder['summary'],
): Promise<SaleResult> {
  if (useNetworkStore.getState().online) {
    try {
      return { kind: 'sent', order: await ordersApi.create(request) }
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
  }

  const tenant = tenantId()
  if (!tenant) throw new Error('Cannot queue a sale without a signed-in user')

  const queued: QueuedOrder = {
    clientOrderId: request.clientOrderId,
    tenantId: tenant,
    request,
    summary,
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  await offlineDb.putOrder(queued)
  // From here on this device holds a sale that exists nowhere else.
  void protectStorage()
  await deductLocalStock(request.items)
  await loadQueue()
  return { kind: 'queued', queued }
}

export interface SyncReport {
  sent: number
  failed: number
}

/**
 * Sends the pending orders, oldest first. Stops at the first sign the server is unreachable
 * (the rest stay pending). An order the server refuses is marked 'failed' and left for a
 * person to retry or discard; it is not retried automatically.
 */
export async function syncQueue(): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, failed: 0 }
  const tenant = tenantId()
  if (!tenant || useOrderQueue.getState().syncing || !useNetworkStore.getState().online) {
    return report
  }

  useOrderQueue.setState({ syncing: true })
  try {
    const pending = (await offlineDb.listOrders(tenant)).filter((o) => o.status === 'pending')
    for (const queued of pending) {
      try {
        await ordersApi.create(queued.request)
        await offlineDb.deleteOrder(queued.clientOrderId)
        report.sent++
      } catch (error) {
        if (isNetworkError(error)) break
        const problem = getProblem(error)
        await offlineDb.putOrder({
          ...queued,
          status: 'failed',
          error: errorMessage(error, ''),
          errorCode: problem?.code,
          errorParams: problem?.params,
        })
        report.failed++
      }
    }
  } finally {
    useOrderQueue.setState({ syncing: false })
    await loadQueue()
  }

  if (report.sent > 0) {
    // The server now has new sales: refresh stock everywhere, including the offline copy.
    void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
    void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })
    void syncCatalog()
  }
  return report
}

/** Puts a refused order back in line (e.g. after restocking) and tries to send it. */
export async function retryOrder(queued: QueuedOrder): Promise<SyncReport> {
  await offlineDb.putOrder({ ...queued, status: 'pending', error: undefined })
  await loadQueue()
  return syncQueue()
}

/** Removes an order for good. The sale is then not recorded anywhere. */
export async function discardOrder(clientOrderId: string): Promise<void> {
  await offlineDb.deleteOrder(clientOrderId)
  await loadQueue()
}
