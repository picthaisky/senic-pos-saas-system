import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
} from '@/components/ui'
import i18n from '@/i18n'
import { formatDateTime, formatNumber } from '@/lib/format'
import {
  AUDIT_ENTITY_TYPES,
  type AuditEntityType,
  type AuditEntry,
  type AuditValue,
  useAuditLog,
} from '../api'

const actionTone = { Created: 'success', Updated: 'primary', Deleted: 'danger' } as const

/** The API hides secret values (a password) behind this marker: only the fact of the change is shown. */
const HIDDEN = '***'

/** A translation when there is one, otherwise the raw name, so an unknown field is still shown. */
function translated(key: string, fallback: string): string {
  return i18n.exists(key) ? i18n.t(key as 'audit.fields.name') : fallback
}

function formatValue(value: AuditValue): string {
  if (value === null || value === '') return '–'
  if (typeof value === 'boolean') return i18n.t(value ? 'audit.yes' : 'audit.no')
  if (typeof value === 'number') return formatNumber(value)
  // Enum values such as a role or a bill status.
  return translated(`audit.values.${value}`, value)
}

function Changes({ entry }: { entry: AuditEntry }) {
  // For a new or deleted record the name says it all; the field list would only be noise.
  if (entry.action !== 'Updated') return <span className="text-muted">–</span>
  return (
    <ul className="flex flex-col gap-0.5">
      {Object.entries(entry.changes).map(([field, change]) => (
        <li key={field} className="flex flex-wrap items-center gap-x-1.5">
          <span className="text-muted">{translated(`audit.fields.${field}`, field)}</span>
          {change.new !== HIDDEN && change.old !== HIDDEN && (
            <>
              <span>{formatValue(change.old)}</span>
              <ArrowRight className="size-3.5 text-muted" aria-label={i18n.t('audit.changedTo')} />
              <span className="font-medium">{formatValue(change.new)}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function AuditPage() {
  const { t } = useTranslation()
  const [entityType, setEntityType] = useState<AuditEntityType | ''>('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const audit = useAuditLog({ entityType: entityType || undefined, page: page + 1, pageSize })

  const columns: Column<AuditEntry>[] = [
    {
      key: 'time',
      header: t('audit.time'),
      cell: (entry) => <span className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</span>,
    },
    {
      key: 'user',
      header: t('audit.user'),
      cell: (entry) =>
        entry.userName ?? <span className="text-muted">{t('audit.unknownUser')}</span>,
    },
    {
      key: 'action',
      header: t('audit.action'),
      cell: (entry) => (
        <Badge tone={actionTone[entry.action]}>{t(`audit.actions.${entry.action}`)}</Badge>
      ),
    },
    {
      key: 'entity',
      header: t('audit.entity'),
      cell: (entry) => (
        <span className="flex flex-col">
          <span className="font-medium">{entry.entityLabel}</span>
          <span className="text-xs text-muted">{t(`audit.types.${entry.entityType}`)}</span>
        </span>
      ),
    },
    { key: 'changes', header: t('audit.changes'), cell: (entry) => <Changes entry={entry} /> },
  ]

  return (
    <>
      <PageHeader title={t('nav.audit')} />

      <Card>
        <div className="mb-4 max-w-xs">
          <Select
            label={t('audit.filterType')}
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value as AuditEntityType | '')
              setPage(0)
            }}
          >
            <option value="">{t('audit.allTypes')}</option>
            {AUDIT_ENTITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`audit.types.${type}`)}
              </option>
            ))}
          </Select>
        </div>

        {audit.isError ? (
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void audit.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : (
          <>
            <DataTable
              caption={t('nav.audit')}
              columns={columns}
              rows={audit.data?.items ?? []}
              rowKey={(entry) => entry.id}
              loading={audit.isPending}
              empty={t('audit.empty')}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={audit.data?.total ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(0)
              }}
            />
          </>
        )}
      </Card>
    </>
  )
}
