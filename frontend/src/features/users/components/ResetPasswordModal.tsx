import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Input, Modal } from '@/components/ui'
import { toast } from '@/stores/toast'
import { useResetPassword } from '../api'
import { type ManagedUser, MAX_PASSWORD_LENGTH, MIN_NEW_PASSWORD_LENGTH } from '../types'

/** A manager sets a new password for someone who forgot theirs. Mount it only while open. */
export function ResetPasswordModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { t } = useTranslation()
  const formId = useId()
  const reset = useResetPassword()

  const schema = useMemo(
    () =>
      z.object({
        newPassword: z
          .string()
          .min(MIN_NEW_PASSWORD_LENGTH, t('validation.passwordMin'))
          .max(MAX_PASSWORD_LENGTH, t('validation.passwordMax')),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { newPassword: '' } })

  const onSubmit = handleSubmit(({ newPassword }) => {
    reset.mutate(
      { id: user.id, newPassword },
      {
        onSuccess: () => {
          toast.success(t('users.passwordReset', { name: user.name }))
          onClose()
        },
        onError: () => toast.error(t('common.error')),
      },
    )
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('users.resetPassword')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={reset.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('users.resetPasswordHelp', { name: user.name })}</p>
        <Input
          label={t('users.newPassword')}
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
      </form>
    </Modal>
  )
}
