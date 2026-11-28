import { Download, Eye, Pencil, Star, Trash2, UserSearch } from 'lucide-react'
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
  PageHeader,
} from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { type CsvColumn, datedFilename, downloadCsv } from '@/lib/export-csv'
import { formatNumber } from '@/lib/format'
import { toast } from '@/stores/toast'
import { useCustomers, useDeleteCustomer } from '../api'
import { CustomerDetail } from '../components/CustomerDetail'
import { CustomerEditModal } from '../components/CustomerEditModal'
import { CustomerForm } from '../components/CustomerForm'
import type { Customer } from '../types'

export function CustomersPage() {
  const { t } = useTranslation()
  const customers = useCustomers()
  const remove = useDeleteCustomer()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [editing, setEditing] = useState<Customer | null>(null)

  // Looked up from the list so the detail panel shows fresh points after each change.
  const selected = customers.data?.find((customer) => customer.id === selectedId) ?? null

  function exportCsv() {
    const exportColumns: CsvColumn<Customer>[] = [
      { header: t('customers.firstName'), value: (customer) => customer.firstName },
      { header: t('customers.lastName'), value: (customer) => customer.lastName },
      { header: t('customers.email'), value: (customer) => customer.email },
      { header: t('customers.phone'), value: (customer) => customer.phone },
      { header: t('customers.points'), value: (customer) => customer.loyaltyPoints },
    ]
    downloadCsv(datedFilename('customers'), customers.data ?? [], exportColumns)
  }

  function confirmDelete() {
    if (!deleting) return
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('customers.deleted'))
        setDeleting(null)
      },
      onError: (error) => toast.error(errorMessage(error, t('common.error'))),
    })
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: t('customers.name'),
      cell: (customer) => <span className="font-medium">{customer.fullName}</span>,
    },
    { key: 'email', header: t('customers.email'), cell: (customer) => customer.email ?? '–' },
    { key: 'phone', header: t('customers.phone'), cell: (customer) => customer.phone ?? '–' },
    {
      key: 'points',
      header: t('customers.points'),
      align: 'right',
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
            onClick={() => setSelectedId(customer.id)}
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
          <Button variant="secondary" disabled={!customers.data?.length} onClick={exportCsv}>
            <Download className="size-5" />
            {t('common.exportCsv')}
          </Button>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <CustomerForm />
          <Card title={t('customers.list')}>
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
              <DataTable
                caption={t('customers.list')}
                columns={columns}
                rows={customers.data ?? []}
                rowKey={(customer) => customer.id}
                loading={customers.isPending}
                empty={t('customers.empty')}
              />
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
