import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { PageSpinner } from './Spinner'

export interface SortState {
  key: string
  direction: 'asc' | 'desc'
}

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Makes the header a button that toggles sorting by this column's `key`. */
  sortable?: boolean
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
  sort?: SortState | null
  onSortChange?: (sort: SortState) => void
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' }

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  caption,
  sort,
  onSortChange,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  if (loading) return <PageSpinner />

  function toggleSort(key: string) {
    const direction = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc'
    onSortChange?.({ key, direction })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            {columns.map((column) => {
              const active = sort?.key === column.key ? sort.direction : null
              const SortIcon =
                active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? active === 'asc'
                        ? 'ascending'
                        : active === 'desc'
                          ? 'descending'
                          : 'none'
                      : undefined
                  }
                  className={cn(
                    'px-3 py-2.5 font-medium whitespace-nowrap',
                    alignClass[column.align ?? 'left'],
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1 rounded hover:text-fg',
                        active && 'text-fg',
                      )}
                    >
                      {column.header}
                      <SortIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
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
                    className={cn('px-3 py-2.5', alignClass[column.align ?? 'left'])}
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
