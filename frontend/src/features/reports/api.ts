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
    /** What the goods sold cost the shop, for the lines whose cost was recorded. */
    cost: number
    /** Sales without VAT and after every discount, less `cost`; only over those lines. */
    grossProfit: number
    grossMarginPercent: number
    /** Sales of lines sold before costs were recorded: in neither `cost` nor `grossProfit`. */
    salesWithoutCost: number
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
    /** Null when no unit was sold with a recorded cost. */
    cost: number | null
    profit: number | null
  }[]
  byCategory: {
    category: string | null
    quantity: number
    amount: number
    cost: number | null
    profit: number | null
  }[]
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
