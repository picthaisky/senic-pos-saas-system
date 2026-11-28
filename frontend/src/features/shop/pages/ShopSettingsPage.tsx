import { zodResolver } from '@hookform/resolvers/zod'
import { Save, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Card, ErrorState, Input, PageHeader, PageSpinner, Select } from '@/components/ui'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/stores/toast'
import { type ShopSettings, useSaveShopSettings, useShopSettings } from '../api'
import { pointsDiscountOf, pointsFor, type VatMode } from '../pricing'

const VAT_MODES: readonly VatMode[] = ['None', 'Inclusive', 'Exclusive']

export function ShopSettingsPage() {
  const { t } = useTranslation()
  const settings = useShopSettings()

  return (
    <>
      <PageHeader title={t('nav.settings')} />
      {settings.data ? (
        // Keyed so the form starts again from what the server holds once that arrives.
        <SettingsForm key={settings.dataUpdatedAt} settings={settings.data} />
      ) : settings.isError ? (
        <Card>
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void settings.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        </Card>
      ) : (
        <PageSpinner />
      )}
    </>
  )
}

function SettingsForm({ settings }: { settings: ShopSettings }) {
  const { t } = useTranslation()
  const save = useSaveShopSettings()

  const schema = useMemo(
    () =>
      z.object({
        shopName: z.string().trim().max(200),
        address: z.string().trim().max(500),
        phone: z.string().trim().max(20),
        taxId: z.union([z.literal(''), z.string().regex(/^\d{13}$/, t('settings.taxIdInvalid'))]),
        branch: z.string().trim().max(100),
        vatMode: z.enum(['None', 'Inclusive', 'Exclusive']),
        vatRatePercent: z
          .number({ error: t('validation.number') })
          .min(0, t('validation.nonNegative'))
          .max(100, t('settings.rateTooHigh')),
        bahtPerPoint: z
          .number({ error: t('validation.number') })
          .min(0, t('validation.nonNegative')),
        pointValueBaht: z
          .number({ error: t('validation.number') })
          .min(0, t('validation.nonNegative')),
        receiptFooter: z.string().trim().max(500),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      shopName: settings.shopName,
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      taxId: settings.taxId ?? '',
      branch: settings.branch ?? '',
      vatMode: settings.vatMode,
      vatRatePercent: settings.vatRatePercent,
      bahtPerPoint: settings.bahtPerPoint,
      pointValueBaht: settings.pointValueBaht,
      receiptFooter: settings.receiptFooter ?? '',
    },
  })

  const vatMode = useWatch({ control, name: 'vatMode' })
  const bahtPerPoint = useWatch({ control, name: 'bahtPerPoint' }) || 0
  const pointValueBaht = useWatch({ control, name: 'pointValueBaht' }) || 0

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      {
        ...values,
        address: values.address || null,
        phone: values.phone || null,
        taxId: values.taxId || null,
        branch: values.branch || null,
        receiptFooter: values.receiptFooter || null,
      },
      {
        onSuccess: () => toast.success(t('settings.saved')),
        onError: () => toast.error(t('common.error')),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-4">
      <Card title={t('settings.shop')}>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Input
            label={t('settings.shopName')}
            hint={t('settings.shopNameHint')}
            autoComplete="off"
            error={errors.shopName?.message}
            {...register('shopName')}
          />
          <Input
            label={t('settings.phone')}
            type="tel"
            autoComplete="off"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('settings.address')}
              autoComplete="off"
              error={errors.address?.message}
              {...register('address')}
            />
          </div>
          <Input
            label={t('settings.taxId')}
            inputMode="numeric"
            autoComplete="off"
            hint={t('settings.taxIdHint')}
            error={errors.taxId?.message}
            {...register('taxId')}
          />
          <Input
            label={t('settings.branch')}
            autoComplete="off"
            hint={t('settings.branchHint')}
            error={errors.branch?.message}
            {...register('branch')}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('settings.receiptFooter')}
              autoComplete="off"
              error={errors.receiptFooter?.message}
              {...register('receiptFooter')}
            />
          </div>
        </div>
      </Card>

      <Card title={t('settings.vat')}>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Select
            label={t('settings.vatMode')}
            hint={t(`settings.vatModeHints.${vatMode}`)}
            error={errors.vatMode?.message}
            {...register('vatMode')}
          >
            {VAT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`settings.vatModes.${mode}`)}
              </option>
            ))}
          </Select>
          {vatMode !== 'None' && (
            <Input
              label={t('settings.vatRate')}
              inputMode="decimal"
              autoComplete="off"
              hint={t('settings.vatRateHint')}
              error={errors.vatRatePercent?.message}
              {...register('vatRatePercent', { valueAsNumber: true })}
            />
          )}
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          {t('settings.vatNotice')}
        </p>
      </Card>

      <Card title={t('settings.points')}>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Input
            label={t('settings.bahtPerPoint')}
            inputMode="decimal"
            autoComplete="off"
            hint={
              bahtPerPoint > 0
                ? t('settings.pointsExample', { points: pointsFor(1000, bahtPerPoint) })
                : t('settings.pointsOff')
            }
            error={errors.bahtPerPoint?.message}
            {...register('bahtPerPoint', { valueAsNumber: true })}
          />
          <Input
            label={t('settings.pointValueBaht')}
            inputMode="decimal"
            autoComplete="off"
            hint={
              pointValueBaht > 0
                ? t('settings.pointValueExample', {
                    amount: formatCurrency(pointsDiscountOf(100, pointValueBaht)),
                  })
                : t('settings.pointValueOff')
            }
            error={errors.pointValueBaht?.message}
            {...register('pointValueBaht', { valueAsNumber: true })}
          />
        </div>
        <p className="mt-4 text-sm text-muted">{t('settings.pointsRules')}</p>
      </Card>

      <div>
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          {!save.isPending && <Save className="size-5" />}
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
