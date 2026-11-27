import { KeyRound, Pencil, UserCheck, UserPlus, UserX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  type Column,
  ConfirmDialog,
  DataTable,
  ErrorState,
  PageHeader,
} from '@/components/ui'
import { getStatus } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/stores/toast'
import { useUpdateUser, useUsers } from '../api'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import { UserFormModal } from '../components/UserFormModal'
import type { ManagedUser } from '../types'

export function UsersPage() {
  const { t } = useTranslation()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const users = useUsers()
  const update = useUpdateUser()
  // `null` = adding a new user; `undefined` = the form is closed.
  const [editing, setEditing] = useState<ManagedUser | null | undefined>(undefined)
  const [resetting, setResetting] = useState<ManagedUser | null>(null)
  const [deactivating, setDeactivating] = useState<ManagedUser | null>(null)

  function setActive(user: ManagedUser, isActive: boolean) {
    update.mutate(
      { id: user.id, changes: { isActive } },
      {
        onSuccess: () => {
          toast.success(t(isActive ? 'users.activated' : 'users.deactivated', { name: user.name }))
          setDeactivating(null)
        },
        onError: (error) => {
          toast.error(getStatus(error) === 409 ? t('users.lastOwner') : t('common.error'))
          setDeactivating(null)
        },
      },
    )
  }

  const columns: Column<ManagedUser>[] = [
    {
      key: 'name',
      header: t('users.name'),
      cell: (user) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{user.name}</span>
          {user.id === currentUserId && <Badge tone="primary">{t('users.you')}</Badge>}
        </span>
      ),
    },
    { key: 'email', header: t('users.email'), cell: (user) => user.email },
    { key: 'role', header: t('users.role'), cell: (user) => t(`roles.${user.role}`) },
    {
      key: 'status',
      header: t('users.status'),
      cell: (user) =>
        user.isActive ? (
          <Badge tone="success">{t('users.active')}</Badge>
        ) : (
          <Badge>{t('users.inactive')}</Badge>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      cell: (user) => {
        const isSelf = user.id === currentUserId
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('users.editNamed', { name: user.name })}
              title={t('users.editUser')}
              onClick={() => setEditing(user)}
            >
              <Pencil className="size-4" />
            </Button>
            {/* Your own password is changed from the top bar, where the current one is asked for. */}
            {!isSelf && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('users.resetPasswordNamed', { name: user.name })}
                title={t('users.resetPassword')}
                onClick={() => setResetting(user)}
              >
                <KeyRound className="size-4" />
              </Button>
            )}
            {!isSelf &&
              (user.isActive ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-danger"
                  aria-label={t('users.deactivateNamed', { name: user.name })}
                  title={t('users.deactivate')}
                  onClick={() => setDeactivating(user)}
                >
                  <UserX className="size-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('users.activateNamed', { name: user.name })}
                  title={t('users.activate')}
                  onClick={() => setActive(user, true)}
                >
                  <UserCheck className="size-4" />
                </Button>
              ))}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title={t('nav.users')}
        actions={
          <Button onClick={() => setEditing(null)}>
            <UserPlus className="size-5" />
            {t('users.addUser')}
          </Button>
        }
      />

      <Card title={t('users.list')}>
        {users.isError ? (
          <ErrorState
            message={t('common.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void users.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : (
          <DataTable
            caption={t('users.list')}
            columns={columns}
            rows={users.data ?? []}
            rowKey={(user) => user.id}
            loading={users.isPending}
            empty={t('common.noData')}
          />
        )}
      </Card>

      {editing !== undefined && (
        <UserFormModal
          key={editing?.id ?? 'new'}
          user={editing}
          isSelf={!!editing && editing.id === currentUserId}
          onClose={() => setEditing(undefined)}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          key={resetting.id}
          user={resetting}
          onClose={() => setResetting(null)}
        />
      )}

      <ConfirmDialog
        open={!!deactivating}
        title={t('users.deactivate')}
        confirmLabel={t('users.deactivate')}
        danger
        loading={update.isPending}
        onConfirm={() => deactivating && setActive(deactivating, false)}
        onCancel={() => setDeactivating(null)}
      >
        {t('users.deactivateConfirm', { name: deactivating?.name })}
      </ConfirmDialog>
    </>
  )
}
