import { inventoryApi } from '@/features/inventory/api'
import type { InventoryItem } from '@/features/inventory/types'
import { isNetworkError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { offlineDb } from './db'

// The till looks products up on the server while it can, and in a local copy of the catalog
// when it cannot. The copy is refreshed whenever the POS opens or the connection returns.

export interface ProductLookup<T> {
  result: T
  /** 'local' = answered from the copy on this device; stock levels may be out of date. */
  source: 'server' | 'local'
}

const tenantId = () => useAuthStore.getState().user?.tenantId

/** Downloads the sellable items for offline use. Does nothing when offline; never throws. */
export async function syncCatalog(): Promise<void> {
  const tenant = tenantId()
  if (!tenant || !useNetworkStore.getState().online) return
  try {
    const items = await inventoryApi.list({ isActive: true })
    await offlineDb.putCatalog({ tenantId: tenant, items, syncedAt: new Date().toISOString() })
  } catch {
    // Best effort: the previous copy stays in place.
  }
}

async function localItems(): Promise<InventoryItem[]> {
  const tenant = tenantId()
  return tenant ? ((await offlineDb.getCatalog(tenant))?.items ?? []) : []
}

/** Runs `online`; if the server cannot be reached, answers from the local catalog instead. */
async function withFallback<T>(
  online: () => Promise<T>,
  local: (items: InventoryItem[]) => T,
): Promise<ProductLookup<T>> {
  if (useNetworkStore.getState().online) {
    try {
      return { result: await online(), source: 'server' }
    } catch (error) {
      if (!isNetworkError(error)) throw error
    }
  }
  return { result: local(await localItems()), source: 'local' }
}

export function searchProducts(query: string): Promise<ProductLookup<InventoryItem[]>> {
  const term = query.toLowerCase()
  return withFallback(
    () => inventoryApi.list({ search: query, isActive: true }),
    (items) =>
      items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.sku.toLowerCase().includes(term) ||
          !!item.barcode?.includes(term),
      ),
  )
}

/** `result` is null when no item has this barcode. */
export function findByBarcode(barcode: string): Promise<ProductLookup<InventoryItem | null>> {
  return withFallback(
    () =>
      inventoryApi.getByBarcode(barcode).catch((error: unknown) => {
        if (isNetworkError(error)) throw error
        return null // 404
      }),
    (items) => items.find((item) => item.barcode === barcode) ?? null,
  )
}

/**
 * Lowers the local stock by what was just sold offline, so the till does not keep offering
 * units that are already gone. The server's figures replace these on the next sync.
 */
export async function deductLocalStock(lines: { inventoryItemId: string; quantity: number }[]) {
  const tenant = tenantId()
  const snapshot = tenant ? await offlineDb.getCatalog(tenant) : undefined
  if (!snapshot) return
  const sold = new Map(lines.map((line) => [line.inventoryItemId, line.quantity]))
  await offlineDb.putCatalog({
    ...snapshot,
    items: snapshot.items.map((item) =>
      sold.has(item.id)
        ? { ...item, quantity: Math.max(0, item.quantity - sold.get(item.id)!) }
        : item,
    ),
  })
}
