import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import type { Order, OrderStatus } from '@/features/pos/types'
import { api } from '@/lib/api'

// docs/API_REFERENCE.md §5. The list is not paged by the server yet, so the page always asks
// for a bounded range of days.

export interface OrderFilter {
  /** `YYYY-MM-DD`, days of the shop's time zone, both inclusive. */
  from: string
  to: string
  status?: OrderStatus
}

export const ORDERS_KEY = ['orders'] as const

/** Newest first. */
export function useOrders(filter: OrderFilter, enabled = true) {
  return useQuery({
    queryKey: [...ORDERS_KEY, 'list', filter],
    queryFn: () => api.get<Order[]>('/orders', { params: filter }).then((r) => r.data),
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
