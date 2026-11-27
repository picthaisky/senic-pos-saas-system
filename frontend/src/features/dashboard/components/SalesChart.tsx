import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactCurrency, formatCurrency, formatDay, formatNumber } from '@/lib/format'
import type { DailySales } from '../api'

// One series (sales per day), so a single hue and no legend: the card title names it.
// Colours come from the theme tokens so the chart follows light/dark mode.
const SERIES = 'var(--app-primary)'
const AXIS_TEXT = { fill: 'var(--app-muted)', fontSize: 12 }

export function SalesChart({ data }: { data: DailySales[] }) {
  const { t } = useTranslation()
  // With many days, label only some ticks so they do not collide.
  const tickInterval = data.length > 14 ? Math.ceil(data.length / 10) - 1 : 0

  return (
    <>
      <div className="h-72" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={false} stroke="var(--app-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              interval={tickInterval}
              tick={AXIS_TEXT}
              tickLine={false}
              axisLine={{ stroke: 'var(--app-border)' }}
            />
            <YAxis
              tickFormatter={formatCompactCurrency}
              tick={AXIS_TEXT}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              cursor={{ fill: 'var(--app-fg)', fillOpacity: 0.06 }}
              content={({ active, payload }) => {
                const day = active ? (payload?.[0]?.payload as DailySales | undefined) : undefined
                if (!day) return null
                return (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-lg">
                    <p className="text-muted">{formatDay(day.date)}</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(day.total)}</p>
                    <p className="text-muted tabular-nums">
                      {t('dashboard.ordersCount', { count: day.orderCount })}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="total" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Same data as a table for screen readers; the chart above is hidden from them. */}
      <table className="sr-only">
        <caption>{t('dashboard.salesByDay')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('dashboard.date')}</th>
            <th scope="col">{t('dashboard.totalSales')}</th>
            <th scope="col">{t('dashboard.orders')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDay(day.date)}</th>
              <td>{formatCurrency(day.total)}</td>
              <td>{formatNumber(day.orderCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
