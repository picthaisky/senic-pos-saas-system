import { Download, Eye, Pencil, Search, Star, Trash2, UserSearch } from 'lucide-react'
import { useState } from 'react'
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
} from '@/components/ui'
import type { SortState } from '@/components/ui/DataTable'
import { errorMessage } from '@/lib/api'
import { type CsvColumn, datedFilename, downloadCsv } from '@/lib/export-csv'
import { formatNumber } from '@/lib/format'
import { clampPage, toSortParam } from '@/lib/paging'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { toast } from '@/stores/toast'
import { customersApi, useCustomersPage, useDeleteCustomer } from '../api'
import { CustomerDetail } from '../components/CustomerDetail'
import { CustomerEditModal } from '../components/CustomerEditModal'
import { CustomerForm } from '../components/CustomerForm'
import type { Customer } from '../types'

export function CustomersPage() {
  const { t } = useTranslation()
  const remove = useDeleteCustomer()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [exporting, setExporting] = useState(false)
  /** The customer in the detail panel, as last seen in the list. */
  const [selectedSeen, setSelectedSeen] = useState<Customer | null>(null)
  const selectedId = selectedSeen?.id ?? null

  // Searching, sorting and paging are done by the server: only one page is ever loaded.
  const debouncedSearch = useDebouncedValue(search.trim()) || undefined
  const [shown, setShown] = useState<{ total?: number }>({})
  const currentPage = clampPage(page, pageSize, shown.total)
  const customers = useCustomersPage(debouncedSearch, {
    page: currentPage + 1,
    pageSize,
    sort: toSortParam(sort),
  })
  if (customers.data && customers.data.total !== shown.total) {
    setShown({ total: customers.data.total })
  }
  const rows = customers.data?.items ?? []
  const total = customers.data?.total ?? 0
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [editing, setEditing] = useState<Customer | null>(null)

  // Taken from the list when it is on the current page, so the panel shows fresh points after
  // each change; otherwise the panel keeps what it had while the list moves to another page.
  const selected = rows.find((customer) => customer.id === selectedId) ?? selectedSeen

  /** Exports every customer matching the search, not just the visible page. */
  async function exportCsv() {
    const exportColumns: CsvColumn<Customer>[] = [
      { header: t('customers.firstName'), value: (customer) => customer.firstName },
      { header: t('customers.lastName'), value: (customer) => customer.lastName },
      { header: t('customers.email'), value: (customer) => customer.email },
      { header: t('customers.phone'), value: (customer) => customer.phone },
      { header: t('customers.points'), value: (customer) => customer.loyaltyPoints },
    ]
    setExporting(true)
    try {
      const all = await customersApi.list(debouncedSearch, toSortParam(sort))
      downloadCsv(datedFilename('customers'), all, exportColumns)
    } catch {
      toast.error(t('common.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  function confirmDelete() {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('customers.deleted'))
        if (deleting.id === selectedId) setSelectedSeen(null)
        setDeleting(null)
      },
      onError: (error) => toast.error(errorMessage(error, t('common.error'))),
    })
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: t('customers.name'),
      sortable: true,
      cell: (customer) => <span className="font-medium">{customer.fullName}</span>,
    },
    { key: 'email', header: t('customers.email'), cell: (customer) => customer.email ?? '–' },
    { key: 'phone', header: t('customers.phone'), cell: (customer) => customer.phone ?? '–' },
    {
      // Named after the API's sort field.
      key: 'loyaltyPoints',
      header: t('customers.points'),
      align: 'right',
      sortable: true,
      cell: (customer) => (
        <Badge tone="primary">
          <Star className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{formatNumber(customer.loyaltyPoints)}</span>
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (customer) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('customers.viewNamed', { name: customer.fullName })}
            aria-pressed={customer.id === selectedId}
            onClick={() => setSelectedSeen(customer)}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('customers.editNamed', { name: customer.fullName })}
            title={t('customers.editCustomer')}
            onClick={() => setEditing(customer)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-danger"
            aria-label={t('customers.deleteNamed', { name: customer.fullName })}
            onClick={() => setDeleting(customer)}
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
        title={t('nav.customers')}
        actions={
          <Button
            variant="secondary"
            disabled={total === 0}
            loading={exporting}
            onClick={() => void exportCsv()}
          >
            {!exporting && <Download className="size-5" />}
            {t('common.exportCsv')}
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <CustomerForm />
          <Card title={t('customers.list')}>
            <div className="mb-4 max-w-md">
              <Input
                label={t('common.search')}
                type="search"
                placeholder={t('customers.searchPlaceholder')}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(0)
                }}
                trailing={<Search className="mr-3 size-5 text-muted" aria-hidden="true" />}
              />
            </div>
            {customers.isError ? (
              <ErrorState
                message={t('common.loadFailed')}
                action={
                  <Button variant="secondary" onClick={() => void customers.refetch()}>
                    {t('common.retry')}
                  </Button>
                }
              />
            ) : (
              <>
                <DataTable
                  caption={t('customers.list')}
                  columns={columns}
                  rows={rows}
                  rowKey={(customer) => customer.id}
                  loading={customers.isPending}
                  empty={debouncedSearch ? t('customers.noMatch') : t('customers.empty')}
                  sort={sort}
                  onSortChange={(next) => {
                    setSort(next)
                    setPage(0)
                  }}
                />
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setPage(0)
                  }}
                />
              </>
            )}
          </Card>
        </div>

        {selected ? (
          <CustomerDetail key={selected.id} customer={selected} />
        ) : (
          <Card>
            <div className="flex flex-col items-center gap-3 py-8 text-center text-muted">
              <UserSearch className="size-12" aria-hidden="true" />
              <p>{t('customers.selectPrompt')}</p>
            </div>
          </Card>
        )}
      </div>

      {editing && (
        <CustomerEditModal key={editing.id} customer={editing} onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={t('customers.deleteTitle')}
        confirmLabel={t('common.delete')}
        danger
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {t('customers.deleteConfirm', { name: deleting?.fullName })}
      </ConfirmDialog>
    </>
  )
}
