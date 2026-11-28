import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PaymentMethod } from '@/features/pos/types'
import { api } from '@/lib/api'

// docs/API_REFERENCE.md, "รายงานยอดขาย". Completed bills only; the server adds everything up.

export interface SalesReport {
  /** `YYYY-MM-DD`, the shop's calendar days. */
  from: string
  to: string
  totals: {
    orderCount: number
    netSales: number
    taxAmount: number
    /** Line discounts, bill discounts and points used. */
    discounts: number
    averageOrderValue: number
    cancelledCount: number
  }
  /** One entry per day of the period, days without sales included. */
  byDay: { date: string; orderCount: number; netSales: number }[]
  /** Best seller first. Amounts are the lines after their own discounts. */
  byItem: {
    inventoryItemId: string
    name: string
    category: string | null
    quantity: number
    amount: number
  }[]
  byCategory: { category: string | null; quantity: number; amount: number }[]
  /** `name` is null for bills made before the seller was recorded. */
  byCashier: { userId: string | null; name: string | null; orderCount: number; netSales: number }[]
  byPaymentMethod: { paymentMethod: PaymentMethod; orderCount: number; netSales: number }[]
}

export interface ReportPeriod {
  from: string
  to: string
}

export const reportsApi = {
  sales: (period: ReportPeriod) =>
    api.get<SalesReport>('/reports/sales', { params: period }).then((r) => r.data),
  /** The same report as an .xlsx file, with headings in `lang`. */
  salesWorkbook: (period: ReportPeriod, lang: string) =>
    api
      .get<Blob>('/reports/sales.xlsx', { params: { ...period, lang }, responseType: 'blob' })
      .then((r) => r.data),
}

export function useSalesReport(period: ReportPeriod, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'sales', period.from, period.to],
    queryFn: () => reportsApi.sales(period),
    enabled,
    placeholderData: keepPreviousData,
  })
}
