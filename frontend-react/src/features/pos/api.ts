import { api } from '@/lib/api'
import type { CreateOrder, Order } from './types'

export const ordersApi = {
  create: (order: CreateOrder) => api.post<Order>('/orders', order).then((r) => r.data),
}
