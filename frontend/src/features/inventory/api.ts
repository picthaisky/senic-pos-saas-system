import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fetchAllPages, type Page, type PageQuery } from '@/lib/paging'
import type {
  CreateInventoryItem,
  InventoryFilter,
  InventoryItem,
  UpdateInventoryItem,
} from './types'

export const inventoryApi = {
  /** One page of the items matching the filter. */
  page: (filter: InventoryFilter, query: PageQuery) =>
    api
      .get<Page<InventoryItem>>('/inventory', { params: { ...filter, ...query } })
      .then((r) => r.data),

  /**
   * Every item matching the filter, read page by page. For a search, an export, and the copy
   * of the catalogue kept for offline use; screens that list items use `page`.
   */
  list: (filter: InventoryFilter = {}, sort?: string) =>
    fetchAllPages((query) => inventoryApi.page(filter, query), sort),

  categories: () => api.get<string[]>('/inventory/categories').then((r) => r.data),

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

export function useInventoryPage(filter: InventoryFilter, query: PageQuery) {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'page', filter, query],
    queryFn: () => inventoryApi.page(filter, query),
    // Keep the current rows on screen while another page or a changed filter loads.
    placeholderData: keepPreviousData,
  })
}

/** Distinct categories across all items, for filter and form suggestions. */
export function useInventoryCategories() {
  return useQuery({
    queryKey: [...INVENTORY_KEY, 'categories'],
    queryFn: inventoryApi.categories,
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
