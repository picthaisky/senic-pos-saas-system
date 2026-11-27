import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Card, Input } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { toast } from '@/stores/toast'
import { useCreateCustomer } from '../api'

export function CustomerForm() {
  const { t } = useTranslation()
  const create = useCreateCustomer()

  const schema = useMemo(
    () =>
      z.object({
        firstName: z.string().trim().min(1, t('validation.required')),
        lastName: z.string().trim(),
        email: z.union([z.literal(''), z.email(t('validation.email'))]),
        phone: z.union([z.literal(''), z.string().regex(/^\d{10}$/, t('validation.phone'))]),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  })

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { ...values, email: values.email || null, phone: values.phone || null },
      {
        onSuccess: () => {
          toast.success(t('customers.created'))
          reset()
        },
        onError: (error) => toast.error(errorMessage(error, t('common.error'))),
      },
    )
  })

  return (
    <Card title={t('customers.addCustomer')}>
      <form onSubmit={onSubmit} noValidate className="grid items-start gap-4 sm:grid-cols-2">
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
          placeholder="name@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label={t('customers.phone')}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0812345678"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <div className="sm:col-span-2">
          <Button type="submit" loading={create.isPending}>
            {!create.isPending && <UserPlus className="size-5" />}
            {t('customers.addCustomer')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
