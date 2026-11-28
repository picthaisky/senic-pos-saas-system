import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import type { Order, OrderStatus } from '@/features/pos/types'
import { api } from '@/lib/api'
import { fetchAllPages, type Page, type PageQuery } from '@/lib/paging'

// docs/API_REFERENCE.md §5.

export interface OrderFilter {
  /** `YYYY-MM-DD`, days of the shop's time zone, both inclusive. */
  from: string
  to: string
  status?: OrderStatus
}

/** A page of bills, with the completed sales of every bill matching the filter. */
export interface OrderPage extends Page<Order> {
  completedCount: number
  completedTotal: number
}

export const ordersApi = {
  page: (filter: OrderFilter, query: PageQuery) =>
    api.get<OrderPage>('/orders', { params: { ...filter, ...query } }).then((r) => r.data),

  /** Every bill matching the filter, read page by page (for an export). Newest first. */
  list: (filter: OrderFilter) => fetchAllPages((query) => ordersApi.page(filter, query)),
}

export const ORDERS_KEY = ['orders'] as const

/** Newest first. */
export function useOrdersPage(filter: OrderFilter, query: PageQuery, enabled = true) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'page', filter, query],
    queryFn: () => ordersApi.page(filter, query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Cancels a bill and puts its items back in stock. Cancelling twice is harmless. */
export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/orders/${id}/cancel`),
    onSuccess: () => {
      // The bill changed, its items are back in stock, the day's sales dropped, and the
      // change history has a new line.
      for (const queryKey of [ORDERS_KEY, INVENTORY_KEY, DASHBOARD_KEY, ['audit']]) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
