import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { NAV_ITEMS } from '@/app/navigation'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { hasAnyRole, useAuthStore } from '@/stores/auth'

interface SidebarProps {
  /** Mobile drawer state; on large screens the sidebar is always visible. */
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const items = NAV_ITEMS.filter((item) => hasAnyRole(user, item.roles))

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform',
          'lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="size-9" />
            <span className="text-lg font-semibold">{t('app.name')}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('nav.closeMenu')}
            onClick={onClose}
            className="lg:hidden"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-1">
            {items.map(({ path, labelKey, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex h-11 items-center gap-3 rounded-lg px-3 font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-primary',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:bg-bg hover:text-fg',
                    )
                  }
                >
                  <Icon className="size-5 shrink-0" />
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {user && (
          <div className="flex items-center gap-3 border-t border-border p-4">
            <div
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-fg"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{t(`roles.${user.role}`)}</p>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
