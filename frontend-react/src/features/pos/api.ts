import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DASHBOARD_KEY } from '@/features/dashboard/api'
import { INVENTORY_KEY } from '@/features/inventory/api'
import { api } from '@/lib/api'
import type { CreateOrder, Order } from './types'

export const ordersApi = {
  create: (order: CreateOrder) => api.post<Order>('/orders', order).then((r) => r.data),
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ordersApi.create,
    // A sale changes stock levels and the dashboard figures.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY })
    },
  })
}
