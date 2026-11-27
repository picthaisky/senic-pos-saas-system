import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Shapes from docs/API_REFERENCE.md §6.

export interface DailySales {
  /** `YYYY-MM-DD` */
  date: string
  total: number
  orderCount: number
}

export interface TopItem {
  inventoryItemId: string
  name: string
  quantity: number
  total: number
}

export interface DashboardSummary {
  totalSales: number
  orderCount: number
  averageOrderValue: number
  lowStockCount: number
  salesByDay: DailySales[]
  topItems: TopItem[]
}

export const DASHBOARD_KEY = ['dashboard'] as const

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Summary for the last `days` days, today included. */
export function useDashboardSummary(days: number) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'summary', days],
    queryFn: () => {
      const to = new Date()
      const from = new Date(to)
      from.setDate(to.getDate() - (days - 1))
      return api
        .get<DashboardSummary>('/dashboard/summary', {
          params: { from: toIsoDate(from), to: toIsoDate(to) },
        })
        .then((r) => r.data)
    },
    placeholderData: keepPreviousData,
  })
}
