import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Input, Modal } from '@/components/ui'
import { getProblem, getStatus } from '@/lib/api'
import { toast } from '@/stores/toast'
import { authApi } from '../api'

// Same limits as the API (PasswordRules in the backend).
const MIN_LENGTH = 8
const MAX_LENGTH = 128

/** The signed-in user changes their own password. Mount it only while open. */
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const formId = useId()
  const [saving, setSaving] = useState(false)

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('validation.required')),
          newPassword: z
            .string()
            .min(MIN_LENGTH, t('validation.passwordMin'))
            .max(MAX_LENGTH, t('validation.passwordMax')),
          confirmPassword: z.string(),
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          path: ['confirmPassword'],
          message: t('validation.passwordMismatch'),
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
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setSaving(true)
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      toast.success(t('account.passwordChanged'))
      onClose()
    } catch (error) {
      const fields = Object.keys(getProblem(error)?.errors ?? {}).map((f) => f.toLowerCase())
      if (getStatus(error) === 400 && fields.includes('currentpassword')) {
        setError('currentPassword', { message: t('account.wrongCurrentPassword') })
      } else if (getStatus(error) === 429) {
        toast.error(t('auth.tooManyAttempts'))
      } else {
        toast.error(t('common.error'))
      }
      setSaving(false)
    }
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('account.changePassword')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('account.currentPassword')}
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label={t('account.newPassword')}
          type="password"
          autoComplete="new-password"
          hint={t('account.otherDevicesHint')}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label={t('account.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </form>
    </Modal>
  )
}
