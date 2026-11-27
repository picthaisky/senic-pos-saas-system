import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Input, Modal } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { toast } from '@/stores/toast'
import { useInventoryCategories, useSaveInventoryItem } from '../api'
import type { InventoryItem } from '../types'

interface ItemFormModalProps {
  /** The item to edit, or null to create a new one. */
  item: InventoryItem | null
  onClose: () => void
}

/** Mount it only while open (with a `key` per item) so the form starts from fresh values. */
export function ItemFormModal({ item, onClose }: ItemFormModalProps) {
  const { t } = useTranslation()
  const formId = useId()
  const categoriesId = useId()
  const categories = useInventoryCategories()
  const save = useSaveInventoryItem()

  const schema = useMemo(() => {
    const required = z.string().trim().min(1, t('validation.required'))
    const money = z.number({ error: t('validation.number') }).min(0, t('validation.nonNegative'))
    const count = z
      .number({ error: t('validation.number') })
      .int(t('validation.integer'))
      .min(0, t('validation.nonNegative'))
    return z.object({
      name: required,
      sku: required,
      barcode: z.string().trim(),
      category: z.string().trim(),
      price: money,
      cost: money,
      quantity: count,
      minimumStock: count,
      isActive: z.boolean(),
    })
  }, [t])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      sku: item?.sku ?? '',
      barcode: item?.barcode ?? '',
      category: item?.category ?? '',
      price: item?.price ?? 0,
      cost: item?.cost ?? 0,
      quantity: item?.quantity ?? 0,
      minimumStock: item?.minimumStock ?? 0,
      isActive: item?.isActive ?? true,
    },
  })

  const onSubmit = handleSubmit((values) => {
    const { sku, barcode, isActive, ...shared } = values
    const common = { ...shared, category: shared.category || null }
    save.mutate(
      item
        ? { id: item.id, item: { ...common, isActive } }
        : { item: { ...common, sku, barcode: barcode || null } },
      {
        onSuccess: () => {
          toast.success(t('inventory.saved'))
          onClose()
        },
        onError: (error) => toast.error(errorMessage(error, t('common.error'))),
      },
    )
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? t('inventory.editItem') : t('inventory.addItem')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label={t('inventory.name')} error={errors.name?.message} {...register('name')} />
        </div>
        <Input
          label={t('inventory.sku')}
          error={errors.sku?.message}
          disabled={!!item}
          {...register('sku')}
        />
        <Input
          label={t('inventory.barcode')}
          error={errors.barcode?.message}
          disabled={!!item}
          {...register('barcode')}
        />
        <div className="sm:col-span-2">
          <Input
            label={t('inventory.category')}
            list={categoriesId}
            error={errors.category?.message}
            {...register('category')}
          />
          <datalist id={categoriesId}>
            {categories.data?.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>
        <Input
          label={t('inventory.price')}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          error={errors.price?.message}
          {...register('price', { valueAsNumber: true })}
        />
        <Input
          label={t('inventory.cost')}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          error={errors.cost?.message}
          {...register('cost', { valueAsNumber: true })}
        />
        <Input
          label={t('inventory.quantity')}
          type="number"
          step="1"
          min="0"
          inputMode="numeric"
          error={errors.quantity?.message}
          {...register('quantity', { valueAsNumber: true })}
        />
        <Input
          label={t('inventory.minimumStock')}
          type="number"
          step="1"
          min="0"
          inputMode="numeric"
          hint={t('inventory.minimumStockHint')}
          error={errors.minimumStock?.message}
          {...register('minimumStock', { valueAsNumber: true })}
        />
        {item && (
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" className="size-4 accent-primary" {...register('isActive')} />
            {t('inventory.activeForSale')}
          </label>
        )}
      </form>
    </Modal>
  )
}
