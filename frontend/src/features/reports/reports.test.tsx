import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { formatCurrency, formatNumber, toIsoDate } from '@/lib/format'
import { renderApp, signIn } from '@/test/render-app'
import { reportsApi } from './api'

// Against the in-memory mock API, which holds two weeks of past sales (walk-in, cash). What
// the page should show is read from the same API, not hard-coded.

const t = i18n.t.bind(i18n)

function day(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return toIsoDate(date)
}

/** The report the page asks for when it opens: the last 30 days. */
async function lastMonth() {
  signIn()
  return reportsApi.sales({ from: day(29), to: day(0) })
}

const totals = () => within(screen.getByRole('region', { name: t('reports.totals') }))
/** The totals, once the report has arrived. */
const loaded = async () => within(await screen.findByRole('region', { name: t('reports.totals') }))
const show = (view: 'byDay' | 'byItem' | 'byCategory' | 'byCashier' | 'byPaymentMethod') =>
  fireEvent.click(screen.getByRole('button', { name: t(`reports.views.${view}`) }))

describe('reports page', () => {
  it('shows the totals of the last 30 days and the sales of each day', async () => {
    const report = await lastMonth()
    expect(report.totals.orderCount).toBeGreaterThan(0)
    renderApp('/reports')

    expect(
      await (await loaded()).findByText(formatCurrency(report.totals.netSales)),
    ).toBeInTheDocument()
    expect(totals().getByText(t('reports.orders')).nextElementSibling).toHaveTextContent(
      formatNumber(report.totals.orderCount),
    )
    // The seeded shop charges no VAT, so there is no tax to show.
    expect(totals().queryByText(t('reports.tax'))).not.toBeInTheDocument()

    const table = within(screen.getByRole('table', { name: t('reports.views.byDay') }))
    // One row per day, days without sales included, and the heading row.
    expect(table.getAllByRole('row')).toHaveLength(31)
  })

  it('shows the same sales by item, category, cashier and payment method', async () => {
    const report = await lastMonth()
    renderApp('/reports')
    await (await loaded()).findByText(formatCurrency(report.totals.netSales))

    show('byItem')
    const items = within(screen.getByRole('table', { name: t('reports.views.byItem') }))
    const best = report.byItem[0]
    const bestRow = within(items.getByText(best.name).closest('tr')!)
    expect(bestRow.getByText(formatCurrency(best.amount))).toBeInTheDocument()
    expect(bestRow.getByText(formatNumber(best.quantity))).toBeInTheDocument()
    // Best seller first.
    expect(items.getAllByRole('row')[1]).toHaveTextContent(best.name)

    show('byCategory')
    const categories = within(screen.getByRole('table', { name: t('reports.views.byCategory') }))
    expect(categories.getAllByRole('row')).toHaveLength(report.byCategory.length + 1)
    expect(categories.getByText(report.byCategory[0].category!)).toBeInTheDocument()

    show('byCashier')
    const cashiers = within(screen.getByRole('table', { name: t('reports.views.byCashier') }))
    expect(cashiers.getByText(report.byCashier[0].name!)).toBeInTheDocument()

    show('byPaymentMethod')
    const payments = within(screen.getByRole('table', { name: t('reports.views.byPaymentMethod') }))
    const cash = within(payments.getByText(t('payment.Cash')).closest('tr')!)
    expect(cash.getByText(formatCurrency(report.totals.netSales))).toBeInTheDocument()
  })

  it('asks again when the period changes, and does not ask for a reversed one', async () => {
    const report = await lastMonth()
    const today = await reportsApi.sales({ from: day(0), to: day(0) })
    renderApp('/reports')
    await (await loaded()).findByText(formatCurrency(report.totals.netSales))

    fireEvent.change(screen.getByLabelText(t('orders.from')), { target: { value: day(0) } })
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: t('reports.views.byDay') })).getAllByRole('row'),
      ).toHaveLength(2),
    )
    expect(totals().getByText(t('reports.orders')).nextElementSibling).toHaveTextContent(
      formatNumber(today.totals.orderCount),
    )

    fireEvent.change(screen.getByLabelText(t('orders.to')), { target: { value: day(5) } })
    expect(await screen.findByText(t('orders.rangeInvalid'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('reports.download') })).toBeDisabled()
  })

  it('downloads the report of the chosen period as an .xlsx file', async () => {
    const report = await lastMonth()
    const workbook = vi.spyOn(reportsApi, 'salesWorkbook')
    const saved: string[] = []
    const createUrl = vi.fn(() => 'blob:report')
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download)
    })
    try {
      renderApp('/reports')
      await (await loaded()).findByText(formatCurrency(report.totals.netSales))

      fireEvent.click(screen.getByRole('button', { name: t('reports.download') }))

      await waitFor(() => expect(saved).toEqual([`sales-${day(29)}-${day(0)}.xlsx`]))
      expect(workbook).toHaveBeenCalledWith({ from: day(29), to: day(0) }, 'th')
      expect(createUrl).toHaveBeenCalledWith(expect.any(Blob))
    } finally {
      click.mockRestore()
      workbook.mockRestore()
    }
  })

  it('is not for a cashier', async () => {
    renderApp('/reports', 'Cashier')
    expect(await screen.findByRole('heading', { name: t('forbidden.title') })).toBeInTheDocument()
  })
})
