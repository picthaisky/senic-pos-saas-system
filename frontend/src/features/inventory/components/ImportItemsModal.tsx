import { useQueryClient } from '@tanstack/react-query'
import { Download, FileUp, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@/components/ui'
import i18n from '@/i18n'
import { errorMessage } from '@/lib/api'
import { downloadCsv } from '@/lib/export-csv'
import { formatNumber } from '@/lib/format'
import { toast } from '@/stores/toast'
import { INVENTORY_KEY, inventoryApi } from '../api'
import type { ItemImportError, ItemImportResult } from '../types'

// Two steps, so nothing is saved by surprise: choosing a file only checks it, and the items
// are saved by the button once the check found no wrong row.

/** The columns of the example file, in the order a person fills them in. */
const COLUMNS = [
  'sku',
  'name',
  'barcode',
  'category',
  'price',
  'cost',
  'quantity',
  'minimumStock',
] as const

/** The sentence for a row's error. "column" arrives as a field name and is shown as its label. */
function rowError(error: ItemImportError): string {
  const key = `errors.${error.code}`
  if (!i18n.exists(key)) return error.message
  const column = typeof error.params.column === 'string' ? error.params.column : null
  const label =
    column && i18n.exists(`inventory.${column}`) ? i18n.t(`inventory.${column}` as never) : column
  return String(i18n.t(key as never, { ...error.params, column: label } as never))
}

export function ImportItemsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ItemImportResult | null>(null)
  /** Why the file itself was refused (wrong type, unreadable, a column missing). */
  const [refusal, setRefusal] = useState<string | null>(null)

  async function check(chosen: File | null) {
    setFile(chosen)
    setResult(null)
    setRefusal(null)
    if (!chosen) return
    setChecking(true)
    try {
      setResult(await inventoryApi.importFile(chosen, true))
    } catch (error) {
      setRefusal(errorMessage(error, t('import.failed')))
    } finally {
      setChecking(false)
    }
  }

  async function save() {
    if (!file) return
    setSaving(true)
    try {
      const done = await inventoryApi.importFile(file, false)
      if (done.applied) {
        toast.success(
          t('import.done', {
            created: formatNumber(done.toCreate),
            updated: formatNumber(done.toUpdate),
          }),
        )
        void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
        void queryClient.invalidateQueries({ queryKey: ['audit'] })
        onClose()
      } else {
        // The shop's items changed between the check and now (a barcode got taken, say).
        setResult(done)
      }
    } catch (error) {
      setRefusal(errorMessage(error, t('import.failed')))
    } finally {
      setSaving(false)
    }
  }

  function downloadExample() {
    const example: Record<(typeof COLUMNS)[number], string | number> = {
      sku: 'A-001',
      name: t('import.exampleName'),
      barcode: '8850000000001',
      category: t('import.exampleCategory'),
      price: 25,
      cost: 18,
      quantity: 10,
      minimumStock: 3,
    }
    downloadCsv(
      'items-example.csv',
      [example],
      COLUMNS.map((column) => ({
        header: t(`inventory.${column}`),
        value: (row: typeof example) => row[column],
      })),
    )
  }

  const ready = !!result && result.errorCount === 0 && result.totalRows > 0

  return (
    <Modal
      open
      onClose={onClose}
      title={t('import.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!ready || checking} loading={saving} onClick={() => void save()}>
            {!saving && <FileUp className="size-5" />}
            {ready
              ? t('import.save', { count: result.totalRows, rows: formatNumber(result.totalRows) })
              : t('import.saveNone')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('import.intro')}</p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium">
              {t('import.file')}
            </label>
            <input
              id={inputId}
              type="file"
              accept=".xlsx,.csv"
              disabled={checking || saving}
              onChange={(event) => void check(event.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </div>
          <Button variant="ghost" onClick={downloadExample}>
            <Download className="size-5" />
            {t('import.example')}
          </Button>
        </div>

        <div aria-live="polite" className="flex flex-col gap-3">
          {checking && <p className="text-sm text-muted">{t('import.checking')}</p>}

          {refusal && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              {refusal}
            </p>
          )}

          {result && (
            <>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {(
                  [
                    ['import.rows', result.totalRows],
                    ['import.toCreate', result.toCreate],
                    ['import.toUpdate', result.toUpdate],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border px-3 py-2">
                    <dt className="text-sm text-muted">{t(label)}</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatNumber(value)}</dd>
                  </div>
                ))}
              </dl>

              {result.toUpdate > 0 && (
                <p className="text-sm text-muted">
                  {result.stockNotChanged > 0
                    ? t('import.stockNotChanged', { rows: formatNumber(result.stockNotChanged) })
                    : t('import.updateNote')}
                </p>
              )}

              {result.errorCount > 0 ? (
                <div>
                  <p role="alert" className="mb-2 flex items-start gap-2 text-sm font-medium">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-danger"
                      aria-hidden="true"
                    />
                    {t('import.hasErrors', { errors: formatNumber(result.errorCount) })}
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">{t('import.errorList')}</caption>
                      <thead className="sticky top-0 bg-surface-muted">
                        <tr>
                          <th scope="col" className="w-20 px-3 py-2 font-medium">
                            {t('import.row')}
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            {t('import.problem')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {result.errors.map((error, index) => (
                          <tr key={`${error.row}-${index}`}>
                            <td className="px-3 py-2 tabular-nums">{error.row}</td>
                            <td className="px-3 py-2">{rowError(error)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.errorCount > result.errors.length && (
                    <p className="mt-2 text-sm text-muted">
                      {t('import.moreErrors', {
                        shown: formatNumber(result.errors.length),
                        total: formatNumber(result.errorCount),
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-success">{t('import.noErrors')}</p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
