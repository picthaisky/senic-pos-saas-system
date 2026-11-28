import { zodResolver } from '@hookform/resolvers/zod'
import { ImageOff, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Input, Modal } from '@/components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '@/lib/api'
import { shrinkImage } from '@/lib/shrink-image'
import { toast } from '@/stores/toast'
import { INVENTORY_KEY, inventoryApi, useInventoryCategories, useSaveInventoryItem } from '../api'
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
  const queryClient = useQueryClient()
  const imageId = useId()

  // The picture is sent after the item itself is saved (a new item has no id before that).
  // `picked` is a newly chosen file; `removed` means the item's own picture is to go.
  const [picked, setPicked] = useState<File | null>(null)
  const [removed, setRemoved] = useState(false)
  const [sendingPicture, setSendingPicture] = useState(false)
  const preview = useMemo(() => (picked ? URL.createObjectURL(picked) : null), [picked])
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview)
  }, [preview])
  const shownPicture = preview ?? (removed ? null : (item?.imageUrl ?? null))

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
        onSuccess: (saved) => void finish(saved.id),
        onError: (error) => toast.error(errorMessage(error, t('common.error'))),
      },
    )
  })

  /** After the item is saved: its picture, if that changed. */
  async function finish(id: string) {
    try {
      if (picked) {
        setSendingPicture(true)
        await inventoryApi.setImage(id, await shrinkImage(picked))
      } else if (removed && item?.imageUrl) {
        setSendingPicture(true)
        await inventoryApi.removeImage(id)
      }
      toast.success(t('inventory.saved'))
    } catch (error) {
      // The item itself is saved; only the picture is not.
      toast.error(errorMessage(error, t('inventory.imageFailed')))
    } finally {
      setSendingPicture(false)
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY })
      onClose()
    }
  }

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
          <Button type="submit" form={formId} loading={save.isPending || sendingPicture}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 sm:col-span-2">
          {shownPicture ? (
            <img
              src={shownPicture}
              alt={t('inventory.imageOf', { name: item?.name ?? t('inventory.addItem') })}
              className="size-20 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted">
              <ImageOff className="size-6" aria-hidden="true" />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={imageId} className="text-sm font-medium">
              {t('inventory.image')}
            </label>
            <input
              id={imageId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setPicked(event.target.files?.[0] ?? null)
                setRemoved(false)
              }}
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted">{t('inventory.imageHint')}</p>
          </div>
          {shownPicture && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0 text-danger"
              aria-label={t('inventory.removeImage')}
              title={t('inventory.removeImage')}
              onClick={() => {
                setPicked(null)
                setRemoved(true)
              }}
            >
              <Trash2 className="size-5" />
            </Button>
          )}
        </div>
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
