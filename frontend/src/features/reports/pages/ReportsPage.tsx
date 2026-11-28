import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  type Column,
  DataTable,
  ErrorState,
  Input,
  PageHeader,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { saveFile } from '@/lib/export-csv'
import { formatCurrency, formatDay, formatNumber, toIsoDate } from '@/lib/format'
import { toast } from '@/stores/toast'
import { reportsApi, type SalesReport, useSalesReport } from '../api'

const VIEWS = ['byDay', 'byItem', 'byCategory', 'byCashier', 'byPaymentMethod'] as const
type View = (typeof VIEWS)[number]

/** The longest list shown on screen; the spreadsheet always has every row. */
const MAX_ROWS = 100

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toIsoDate(date)
}

const money = (value: number) => <span className="tabular-nums">{formatCurrency(value)}</span>
const count = (value: number) => <span className="tabular-nums">{formatNumber(value)}</span>

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const [from, setFrom] = useState(() => daysAgo(29))
  const [to, setTo] = useState(() => daysAgo(0))
  const [view, setView] = useState<View>('byDay')
  const [downloading, setDownloading] = useState(false)

  // An emptied or reversed period is not sent: the last good report stays on screen.
  const reversed = from !== '' && to !== '' && from > to
  const valid = from !== '' && to !== '' && !reversed
  const report = useSalesReport({ from, to }, valid)
  const data = report.data

  async function download() {
    setDownloading(true)
    try {
      const file = await reportsApi.salesWorkbook(
        { from, to },
        i18n.language === 'en' ? 'en' : 'th',
      )
      saveFile(`sales-${from}-${to}.xlsx`, file)
    } catch {
      toast.error(t('common.exportFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const tiles: { label: string; value: string }[] = data
    ? [
        { label: t('reports.netSales'), value: formatCurrency(data.totals.netSales) },
        { label: t('reports.orders'), value: formatNumber(data.totals.orderCount) },
        { label: t('reports.average'), value: formatCurrency(data.totals.averageOrderValue) },
        { label: t('reports.discounts'), value: formatCurrency(data.totals.discounts) },
        // A shop without VAT has no tax to show.
        ...(data.totals.taxAmount > 0
          ? [{ label: t('reports.tax'), value: formatCurrency(data.totals.taxAmount) }]
          : []),
        { label: t('reports.cancelled'), value: formatNumber(data.totals.cancelledCount) },
      ]
    : []

  return (
    <>
      <PageHeader
        title={t('nav.reports')}
        actions={
          <Button
            variant="secondary"
            disabled={!valid || !data}
            loading={downloading}
            onClick={() => void download()}
          >
            {!downloading && <Download className="size-5" />}
            {t('reports.download')}
          </Button>
        }
      />

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <Input
            label={t('orders.from')}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            label={t('orders.to')}
            type="date"
            value={to}
            min={from || undefined}
            error={reversed ? t('orders.rangeInvalid') : undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        {report.isError ? (
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void report.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : (
          <>
            {data && (
              <section aria-label={t('reports.totals')}>
                <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {tiles.map((tile) => (
                    <div key={tile.label} className="rounded-lg border border-border px-4 py-3">
                      <dt className="text-sm text-muted">{tile.label}</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums">{tile.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <div role="group" aria-label={t('reports.view')} className="mb-3 flex flex-wrap gap-2">
              {VIEWS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary',
                    view === option
                      ? 'border-primary bg-primary text-primary-fg'
                      : 'border-border bg-surface hover:bg-surface-muted',
                  )}
                >
                  {t(`reports.views.${option}`)}
                </button>
              ))}
            </div>

            <ReportTable view={view} report={data} loading={report.isLoading} />
            <p className="mt-3 text-sm text-muted">{t('reports.note')}</p>
          </>
        )}
      </Card>
    </>
  )
}

interface ReportTableProps {
  view: View
  report: SalesReport | undefined
  loading: boolean
}

function ReportTable({ view, report, loading }: ReportTableProps) {
  const { t } = useTranslation()
  const caption = t(`reports.views.${view}`)
  const empty = t('reports.empty')

  /** Long lists are cut on screen, and the page says so. */
  function cut<T>(rows: T[] | undefined) {
    const all = rows ?? []
    return {
      rows: all.slice(0, MAX_ROWS),
      more:
        all.length > MAX_ROWS ? (
          <p className="mt-2 text-sm text-muted">
            {t('reports.cut', { shown: MAX_ROWS, total: formatNumber(all.length) })}
          </p>
        ) : null,
    }
  }

  if (view === 'byDay') {
    type Row = SalesReport['byDay'][number]
    const columns: Column<Row>[] = [
      { key: 'date', header: t('reports.date'), cell: (row) => formatDay(row.date) },
      {
        key: 'orders',
        header: t('reports.orders'),
        align: 'right',
        cell: (row) => count(row.orderCount),
      },
      {
        key: 'net',
        header: t('reports.netSales'),
        align: 'right',
        cell: (row) => money(row.netSales),
      },
    ]
    // Newest day first: that is the one people look for.
    const { rows, more } = cut(report ? [...report.byDay].reverse() : undefined)
    return (
      <>
        <DataTable
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.date}
          loading={loading}
          empty={empty}
        />
        {more}
      </>
    )
  }

  if (view === 'byItem') {
    type Row = SalesReport['byItem'][number]
    const columns: Column<Row>[] = [
      {
        key: 'name',
        header: t('reports.item'),
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: 'category',
        header: t('reports.category'),
        cell: (row) =>
          row.category ?? <span className="text-muted">{t('reports.noCategory')}</span>,
      },
      {
        key: 'quantity',
        header: t('reports.quantity'),
        align: 'right',
        cell: (row) => count(row.quantity),
      },
      {
        key: 'amount',
        header: t('reports.amount'),
        align: 'right',
        cell: (row) => money(row.amount),
      },
    ]
    const { rows, more } = cut(report?.byItem)
    return (
      <>
        <DataTable
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.inventoryItemId}
          loading={loading}
          empty={empty}
        />
        {more}
      </>
    )
  }

  if (view === 'byCategory') {
    type Row = SalesReport['byCategory'][number]
    const columns: Column<Row>[] = [
      {
        key: 'category',
        header: t('reports.category'),
        cell: (row) =>
          row.category ?? <span className="text-muted">{t('reports.noCategory')}</span>,
      },
      {
        key: 'quantity',
        header: t('reports.quantity'),
        align: 'right',
        cell: (row) => count(row.quantity),
      },
      {
        key: 'amount',
        header: t('reports.amount'),
        align: 'right',
        cell: (row) => money(row.amount),
      },
    ]
    const { rows, more } = cut(report?.byCategory)
    return (
      <>
        <DataTable
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.category ?? ''}
          loading={loading}
          empty={empty}
        />
        {more}
      </>
    )
  }

  if (view === 'byCashier') {
    type Row = SalesReport['byCashier'][number]
    const columns: Column<Row>[] = [
      {
        key: 'name',
        header: t('reports.cashier'),
        cell: (row) =>
          row.name ?? <span className="text-muted">{t('reports.unknownCashier')}</span>,
      },
      {
        key: 'orders',
        header: t('reports.orders'),
        align: 'right',
        cell: (row) => count(row.orderCount),
      },
      {
        key: 'net',
        header: t('reports.netSales'),
        align: 'right',
        cell: (row) => money(row.netSales),
      },
    ]
    const { rows, more } = cut(report?.byCashier)
    return (
      <>
        <DataTable
          caption={caption}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.userId ?? ''}
          loading={loading}
          empty={empty}
        />
        {more}
      </>
    )
  }

  type Row = SalesReport['byPaymentMethod'][number]
  const columns: Column<Row>[] = [
    {
      key: 'method',
      header: t('orders.payment'),
      cell: (row) => t(`payment.${row.paymentMethod}`),
    },
    {
      key: 'orders',
      header: t('reports.orders'),
      align: 'right',
      cell: (row) => count(row.orderCount),
    },
    {
      key: 'net',
      header: t('reports.netSales'),
      align: 'right',
      cell: (row) => money(row.netSales),
    },
  ]
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={report?.byPaymentMethod ?? []}
      rowKey={(row) => row.paymentMethod}
      loading={loading}
      empty={empty}
    />
  )
}
