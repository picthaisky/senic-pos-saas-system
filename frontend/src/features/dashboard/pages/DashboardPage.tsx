import {
  Banknote,
  type LucideIcon,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  type Column,
  DataTable,
  ErrorState,
  PageHeader,
  PageSpinner,
} from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/format'
import { type TopItem, useDashboardSummary } from '../api'
import { SalesChart } from '../components/SalesChart'

const PERIODS = [7, 30] as const

export function DashboardPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<number>(PERIODS[0])
  const summary = useDashboardSummary(days)
  const data = summary.data

  const topItemColumns: Column<TopItem>[] = [
    { key: 'name', header: t('dashboard.item'), cell: (item) => item.name },
    {
      key: 'quantity',
      header: t('dashboard.unitsSold'),
      align: 'right',
      cell: (item) => <span className="tabular-nums">{formatNumber(item.quantity)}</span>,
    },
    {
      key: 'total',
      header: t('dashboard.totalSales'),
      align: 'right',
      cell: (item) => <span className="tabular-nums">{formatCurrency(item.total)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('nav.dashboard')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted">
              {t('dashboard.period')}
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="h-10 rounded-lg border border-border bg-surface px-3 text-fg"
              >
                {PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {t('dashboard.lastDays', { count: period })}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              loading={summary.isFetching && !summary.isPending}
              onClick={() => void summary.refetch()}
            >
              {!summary.isFetching && <RefreshCw className="size-5" />}
              {t('common.refresh')}
            </Button>
          </>
        }
      />

      {summary.isPending ? (
        <PageSpinner />
      ) : !data ? (
        <ErrorState
          message={t('common.loadFailed')}
          action={
            <Button variant="secondary" onClick={() => void summary.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={Banknote}
              label={t('dashboard.totalSales')}
              value={formatCurrency(data.totalSales)}
            />
            <StatTile
              icon={ShoppingBag}
              label={t('dashboard.orders')}
              value={formatNumber(data.orderCount)}
            />
            <StatTile
              icon={Receipt}
              label={t('dashboard.averageOrder')}
              value={formatCurrency(data.averageOrderValue)}
            />
            <StatTile
              icon={TriangleAlert}
              label={t('dashboard.lowStock')}
              value={formatNumber(data.lowStockCount)}
              warning={data.lowStockCount > 0}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card title={t('dashboard.salesByDay')} className="xl:col-span-3">
              <SalesChart data={data.salesByDay} />
            </Card>
            <Card title={t('dashboard.topItems')} className="xl:col-span-2">
              <DataTable
                caption={t('dashboard.topItems')}
                columns={topItemColumns}
                rows={data.topItems}
                rowKey={(item) => item.inventoryItemId}
                empty={t('dashboard.noSales')}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

interface StatTileProps {
  icon: LucideIcon
  label: string
  value: string
  /** Draws attention to a figure that needs action (shown with the icon, not colour alone). */
  warning?: boolean
}

function StatTile({ icon: Icon, label, value, warning }: StatTileProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div
        className={
          warning
            ? 'flex size-12 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning'
            : 'flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'
        }
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  )
}
