import { Languages, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import { authApi } from '@/features/auth/api'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t, i18n } = useTranslation()
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
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
        size="sm"
        className="h-10"
        loading={loggingOut}
        onClick={handleLogout}
      >
        {!loggingOut && <LogOut className="size-5" />}
        {/* Icon-only on small screens; the label stays available to screen readers. */}
        <span className="sr-only sm:not-sr-only">{t('topbar.logout')}</span>
      </Button>
    </header>
  )
}
