import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Button, Input, Modal, Select } from '@/components/ui'
import { getStatus } from '@/lib/api'
import { ROLES } from '@/stores/auth'
import { toast } from '@/stores/toast'
import { useCreateUser, useUpdateUser } from '../api'
import { type ManagedUser, MAX_PASSWORD_LENGTH, MIN_NEW_PASSWORD_LENGTH } from '../types'

interface UserFormModalProps {
  /** The user to edit, or null to add a new one. */
  user: ManagedUser | null
  /** True when `user` is the person signed in: they may rename themselves but not change role. */
  isSelf: boolean
  onClose: () => void
}

/** Mount it only while open (with a `key` per user) so the form starts from fresh values. */
export function UserFormModal({ user, isSelf, onClose }: UserFormModalProps) {
  const { t } = useTranslation()
  const formId = useId()
  const create = useCreateUser()
  const update = useUpdateUser()
  const editing = !!user

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('validation.required')),
        // Email and password are only asked for (and only sent) when adding a user.
        email: editing ? z.string() : z.email(t('validation.email')),
        password: editing
          ? z.string()
          : z
              .string()
              .min(MIN_NEW_PASSWORD_LENGTH, t('validation.passwordMin'))
              .max(MAX_PASSWORD_LENGTH, t('validation.passwordMax')),
        role: z.enum(ROLES),
      }),
    [t, editing],
  )

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'Cashier',
    },
  })

  const onSubmit = handleSubmit((values) => {
    const onSuccess = () => {
      toast.success(t('users.saved'))
      onClose()
    }
    if (user) {
      update.mutate(
        { id: user.id, changes: { name: values.name, role: isSelf ? undefined : values.role } },
        {
          onSuccess,
          onError: (error) =>
            toast.error(getStatus(error) === 409 ? t('users.lastOwner') : t('common.error')),
        },
      )
    } else {
      create.mutate(
        { ...values, email: values.email.trim() },
        {
          onSuccess,
          onError: (error) => {
            if (getStatus(error) === 409) setError('email', { message: t('users.emailTaken') })
            else toast.error(t('common.error'))
          },
        },
      )
    }
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? t('users.editUser') : t('users.addUser')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} loading={create.isPending || update.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('users.name')}
          autoComplete="off"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label={t('users.email')}
          type="email"
          autoComplete="off"
          disabled={editing}
          error={errors.email?.message}
          {...register('email')}
        />
        <Select
          label={t('users.role')}
          disabled={isSelf}
          hint={isSelf ? t('users.ownRoleHint') : t('users.roleHint')}
          error={errors.role?.message}
          {...register('role')}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </Select>
        {!editing && (
          <Input
            label={t('users.initialPassword')}
            type="password"
            autoComplete="new-password"
            hint={t('users.initialPasswordHint')}
            error={errors.password?.message}
            {...register('password')}
          />
        )}
      </form>
    </Modal>
  )
}
