import { messageForCode } from '@/lib/api'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'
import type { InventoryItem } from '@/features/inventory/types'
import type { CreateOrder } from '../types'

/** The sellable items of one tenant as of the last successful sync. */
export interface CatalogSnapshot {
  tenantId: string
  items: InventoryItem[]
  syncedAt: string
}

/** A sale made while the server was unreachable, waiting to be sent. */
export interface QueuedOrder {
  /** Same id as `request.clientOrderId`; the server uses it to ignore duplicates. */
  clientOrderId: string
  /** The order is only ever sent while a user of this tenant is signed in. */
  tenantId: string
  request: CreateOrder
  /** What the cashier saw, for the queue list (the server recalculates the real amounts). */
  summary: { lines: { name: string; quantity: number; unitPrice: number }[]; total: number }
  createdAt: string
  /** 'failed' = the server answered and refused it (e.g. stock ran out); needs a person. */
  status: 'pending' | 'failed'
  /** Why the server refused it, as text in the language in use at that moment. */
  error?: string
  /** The same as a server error code with its values, to say it in the language in use now. */
  errorCode?: string
  errorParams?: Record<string, string | number | null>
}

/** Why the server refused the bill, in the current language when the reason has a code. */
export function refusalOf(order: QueuedOrder): string | undefined {
  return messageForCode(order.errorCode, order.errorParams) ?? order.error
}

interface PosDb extends DBSchema {
  catalog: { key: string; value: CatalogSnapshot }
  orderQueue: { key: string; value: QueuedOrder; indexes: { byTenant: string } }
}

let dbPromise: Promise<IDBPDatabase<PosDb>> | null = null

function db() {
  dbPromise ??= openDB<PosDb>('senic-pos', 1, {
    upgrade(database) {
      database.createObjectStore('catalog', { keyPath: 'tenantId' })
      database
        .createObjectStore('orderQueue', { keyPath: 'clientOrderId' })
        .createIndex('byTenant', 'tenantId')
    },
  })
  return dbPromise
}

export const offlineDb = {
  getCatalog: async (tenantId: string) => (await db()).get('catalog', tenantId),
  putCatalog: async (snapshot: CatalogSnapshot) =>
    void (await (await db()).put('catalog', snapshot)),

  /** Oldest first, so orders are sent in the order they were made. */
  listOrders: async (tenantId: string) =>
    (await (await db()).getAllFromIndex('orderQueue', 'byTenant', tenantId)).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  putOrder: async (order: QueuedOrder) => void (await (await db()).put('orderQueue', order)),
  deleteOrder: async (clientOrderId: string) => (await db()).delete('orderQueue', clientOrderId),
}
