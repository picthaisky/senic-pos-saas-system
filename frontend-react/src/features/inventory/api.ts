import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  CreateInventoryItem,
  InventoryFilter,
  InventoryItem,
  UpdateInventoryItem,
} from './types'

export const inventoryApi = {
  list: (filter: InventoryFilter = {}) =>
    api.get<InventoryItem[]>('/inventory', { params: filter }).then((r) => r.data),

  /** Rejects with a 404 when no item has this barcode. */
  getByBarcode: (barcode: string) =>
    api.get<InventoryItem>(`/inventory/barcode/${encodeURIComponent(barcode)}`).then((r) => r.data),

  create: (item: CreateInventoryItem) =>
    api.post<InventoryItem>('/inventory', item).then((r) => r.data),

  update: (id: string, item: UpdateInventoryItem) =>
    api.put<InventoryItem>(`/inventory/${id}`, item).then((r) => r.data),

  remove: (id: string) => api.delete<void>(`/inventory/${id}`),
}

/** Everything under this key is refetched after any inventory change (including a sale). */
export const INVENTORY_KEY = ['inventory'] as const

export function useInventory(filter: InventoryFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'list', filter],
    queryFn: () => inventoryApi.list(filter),
    // Keep the current rows on screen while a changed filter loads.
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  })
}

/** Distinct categories across all items, for filter and form suggestions. */
export function useInventoryCategories() {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'list', {}],
    queryFn: () => inventoryApi.list(),
    select: (items) =>
      [...new Set(items.map((item) => item.category).filter((c): c is string => !!c))].sort(),
  })
}

export function useSaveInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      input: { id: string; item: UpdateInventoryItem } | { item: CreateInventoryItem },
    ) =>
      'id' in input ? inventoryApi.update(input.id, input.item) : inventoryApi.create(input.item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVENTORY_KEY }),
  })
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVENTORY_KEY }),
  })
}
