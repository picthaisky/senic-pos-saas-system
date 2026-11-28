import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Input, Modal } from '@/components/ui'
import { getStatus } from '@/lib/api'
import { toast } from '@/stores/toast'
import { useUpdateCustomer } from '../api'
import type { Customer } from '../types'

/** Edits a customer's contact details. Points are changed from the detail panel, not here. */
export function CustomerEditModal({
  customer,
  onClose,
}: {
  customer: Customer
  onClose: () => void
}) {
  const { t } = useTranslation()
  const update = useUpdateCustomer()
  const formId = useId()

  const schema = useMemo(
    () =>
      z.object({
        firstName: z.string().trim().min(1, t('validation.required')).max(100),
        lastName: z.string().trim().max(100),
        email: z.union([z.literal(''), z.email(t('validation.email'))]),
        phone: z.union([z.literal(''), z.string().regex(/^\d{10}$/, t('validation.phone'))]),
        address: z.string().trim().max(500),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    },
  })

  const onSubmit = handleSubmit((values) => {
    // Every field is sent: the API leaves out what is null, and clears what is an empty string.
    update.mutate(
      { id: customer.id, changes: values },
      {
        onSuccess: () => {
          toast.success(t('customers.saved'))
          onClose()
        },
        onError: (error) => {
          if (getStatus(error) === 409) setError('email', { message: t('customers.emailTaken') })
          else toast.error(t('common.error'))
        },
      },
    )
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('customers.editCustomer')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={update.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('customers.firstName')}
          autoComplete="off"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label={t('customers.lastName')}
          autoComplete="off"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
        <Input
          label={t('customers.email')}
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label={t('customers.phone')}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Input
          label={t('customers.address')}
          autoComplete="off"
          error={errors.address?.message}
          {...register('address')}
        />
      </form>
    </Modal>
  )
}
