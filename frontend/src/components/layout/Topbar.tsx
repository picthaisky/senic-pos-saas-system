import { KeyRound, Languages, LogOut, Menu, Moon, Sun, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InstallAppButton } from '@/components/PwaPrompt'
import { PushToggle } from '@/components/PushToggle'
import { Button } from '@/components/ui'
import { authApi } from '@/features/auth/api'
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal'
import { OfflineQueueButton } from '@/features/pos/components/OfflineQueue'
import { disablePush } from '@/lib/push'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { useThemeStore } from '@/stores/theme'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t, i18n } = useTranslation()
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const clearSession = useAuthStore((state) => state.clearSession)
  const online = useNetworkStore((state) => state.online)
  const [loggingOut, setLoggingOut] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    // While the access token still works: stop this browser receiving this user's alerts,
    // so the next person to use the device does not get them.
    await disablePush().catch(() => {})
    try {
      await authApi.logout()
    } catch {
      // Sign out locally even if the server call fails; the access token is dropped either way.
    }
    clearSession() // RequireAuth redirects to the login page
  }

  const ThemeIcon = theme === 'light' ? Moon : Sun

  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-border bg-surface px-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('nav.openMenu')}
        onClick={onOpenMenu}
        className="lg:hidden"
      >
        <Menu className="size-5" />
      </Button>

      <div className="flex-1" />

      {!online && (
        <span
          role="status"
          className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-sm font-medium"
        >
          <WifiOff className="size-4 text-warning" aria-hidden="true" />
          {t('offline.badge')}
        </span>
      )}
      <OfflineQueueButton />
      <InstallAppButton />
      <PushToggle />

      <Button
        variant="ghost"
        size="sm"
        className="h-10"
        aria-label={t('topbar.switchLanguage')}
        title={t('topbar.switchLanguage')}
        onClick={() => void i18n.changeLanguage(i18n.language === 'th' ? 'en' : 'th')}
      >
        <Languages className="size-5" />
        <span className="uppercase">{i18n.language}</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={theme === 'light' ? t('topbar.switchToDark') : t('topbar.switchToLight')}
        title={theme === 'light' ? t('topbar.switchToDark') : t('topbar.switchToLight')}
        onClick={toggleTheme}
      >
        <ThemeIcon className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={t('account.changePassword')}
        title={t('account.changePassword')}
        // Needs the server, so it is not offered while offline.
        disabled={!online}
        onClick={() => setChangingPassword(true)}
      >
        <KeyRound className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-10"
        loading={loggingOut}
        onClick={handleLogout}
      >
        {!loggingOut && <LogOut className="size-5" />}
        {/* Icon-only on small screens; the label stays available to screen readers. */}
        <span className="sr-only sm:not-sr-only">{t('topbar.logout')}</span>
      </Button>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </header>
  )
}
