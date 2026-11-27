import { Download, Pencil, Plus, RefreshCw, Search, Trash2, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  type Column,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Select,
} from '@/components/ui'
import type { SortState } from '@/components/ui/DataTable'
import { errorMessage } from '@/lib/api'
import { type CsvColumn, datedFilename, downloadCsv } from '@/lib/export-csv'
import { formatCurrency, formatNumber } from '@/lib/format'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { toast } from '@/stores/toast'
import { useDeleteInventoryItem, useInventory, useInventoryCategories } from '../api'
import { ItemFormModal } from '../components/ItemFormModal'
import { type InventoryItem, isLowStock } from '../types'

const sorters: Record<string, (a: InventoryItem, b: InventoryItem) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'th'),
  price: (a, b) => a.price - b.price,
  quantity: (a, b) => a.quantity - b.quantity,
}

export function InventoryPage() {
  const { t } = useTranslation()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  /** `'new'` opens an empty form, an item opens it for editing. */
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null)
  const [deleting, setDeleting] = useState<InventoryItem | null>(null)

  const debouncedSearch = useDebouncedValue(search.trim())
  const inventory = useInventory({
    search: debouncedSearch || undefined,
    category: category || undefined,
    lowStock: lowStockOnly || undefined,
  })
  const categories = useInventoryCategories()
  const remove = useDeleteInventoryItem()

  const sorted = useMemo(() => {
    const items = inventory.data ?? []
    if (!sort) return items
    const compare = sorters[sort.key]
    const sign = sort.direction === 'asc' ? 1 : -1
    return [...items].sort((a, b) => sign * compare(a, b))
  }, [inventory.data, sort])

  // Filters can shrink the list below the current page; fall back to the last page that exists.
  const lastPage = Math.max(0, Math.ceil(sorted.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const rows = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  /** Exports every row matching the current filters and sort, not just the visible page. */
  function exportCsv() {
    const exportColumns: CsvColumn<InventoryItem>[] = [
      { header: t('inventory.name'), value: (item) => item.name },
      { header: t('inventory.sku'), value: (item) => item.sku },
      { header: t('inventory.barcode'), value: (item) => item.barcode },
      { header: t('inventory.category'), value: (item) => item.category },
      { header: t('inventory.price'), value: (item) => item.price },
      { header: t('inventory.cost'), value: (item) => item.cost },
      { header: t('inventory.quantity'), value: (item) => item.quantity },
      { header: t('inventory.minimumStock'), value: (item) => item.minimumStock },
      {
        header: t('inventory.status'),
        value: (item) => (item.isActive ? t('inventory.active') : t('inventory.inactive')),
      },
    ]
    downloadCsv(datedFilename('inventory'), sorted, exportColumns)
  }

  function confirmDelete() {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('inventory.deleted'))
        setDeleting(null)
      },
      onError: (error) => toast.error(errorMessage(error, t('common.error'))),
    })
  }

  const columns: Column<InventoryItem>[] = [
    {
      key: 'name',
      header: t('inventory.name'),
      sortable: true,
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    { key: 'sku', header: t('inventory.sku'), cell: (item) => item.sku },
    { key: 'barcode', header: t('inventory.barcode'), cell: (item) => item.barcode ?? '–' },
    {
      key: 'category',
      header: t('inventory.category'),
      cell: (item) => (item.category ? <Badge>{item.category}</Badge> : '–'),
    },
    {
      key: 'price',
      header: t('inventory.price'),
      align: 'right',
      sortable: true,
      cell: (item) => <span className="tabular-nums">{formatCurrency(item.price)}</span>,
    },
    {
      key: 'quantity',
      header: t('inventory.quantity'),
      align: 'right',
      sortable: true,
      cell: (item) =>
        isLowStock(item) ? (
          <span className="inline-flex items-center gap-1 font-semibold text-danger tabular-nums">
            <TriangleAlert className="size-4" aria-label={t('inventory.lowStock')} />
            {formatNumber(item.quantity)}
          </span>
        ) : (
          <span className="tabular-nums">{formatNumber(item.quantity)}</span>
        ),
    },
    {
      key: 'status',
      header: t('inventory.status'),
      cell: (item) =>
        item.isActive ? (
          <Badge tone="success">{t('inventory.active')}</Badge>
        ) : (
          <Badge>{t('inventory.inactive')}</Badge>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (item) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('inventory.editNamed', { name: item.name })}
            onClick={() => setEditing(item)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-danger"
            aria-label={t('inventory.deleteNamed', { name: item.name })}
            onClick={() => setDeleting(item)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('nav.inventory')}
        actions={
          <>
            <Button variant="secondary" disabled={sorted.length === 0} onClick={exportCsv}>
              <Download className="size-5" />
              {t('common.exportCsv')}
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-5" />
              {t('inventory.addItem')}
            </Button>
          </>
        }
      />

      <Card>
        <div className="mb-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_auto_auto]">
          <Input
            label={t('common.search')}
            type="search"
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            trailing={<Search className="mr-3 size-5 text-muted" aria-hidden="true" />}
          />
          <Select
            label={t('inventory.category')}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              setPage(0)
            }}
          >
            <option value="">{t('inventory.allCategories')}</option>
            {categories.data?.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Button
            variant={lowStockOnly ? 'danger' : 'secondary'}
            aria-pressed={lowStockOnly}
            onClick={() => {
              setLowStockOnly((value) => !value)
              setPage(0)
            }}
          >
            <TriangleAlert className="size-5" />
            {t('inventory.lowStock')}
          </Button>
          <Button
            variant="secondary"
            loading={inventory.isFetching && !inventory.isPending}
            onClick={() => void inventory.refetch()}
          >
            {!inventory.isFetching && <RefreshCw className="size-5" />}
            {t('common.refresh')}
          </Button>
        </div>

        {inventory.isError ? (
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void inventory.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : (
          <>
            <DataTable
              caption={t('nav.inventory')}
              columns={columns}
              rows={rows}
              rowKey={(item) => item.id}
              loading={inventory.isPending}
              empty={t('inventory.empty')}
              sort={sort}
              onSortChange={setSort}
            />
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={sorted.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(0)
              }}
            />
          </>
        )}
      </Card>

      {editing && (
        <ItemFormModal
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('inventory.deleteTitle')}
        confirmLabel={t('common.delete')}
        danger
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {t('inventory.deleteConfirm', { name: deleting?.name })}
      </ConfirmDialog>
    </>
  )
}
