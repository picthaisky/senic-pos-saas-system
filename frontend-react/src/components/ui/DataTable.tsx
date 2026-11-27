import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { PageSpinner } from './Spinner'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  /** Shown when there are no rows; defaults to a generic "no data" message. */
  empty?: ReactNode
  /** Accessible name for the table. */
  caption: string
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  caption,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  if (loading) return <PageSpinner />

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-3 py-2.5 font-medium whitespace-nowrap',
                  alignClass[column.align ?? 'left'],
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                {empty ?? t('common.noData')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-bg">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-2.5',
                      alignClass[column.align ?? 'left'],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
