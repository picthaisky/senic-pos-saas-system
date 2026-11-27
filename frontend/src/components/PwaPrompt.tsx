import { Download, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui'

/**
 * Registers the service worker and tells the user when a new version of the app has been
 * downloaded. The update is applied only when they choose to reload, so a sale in progress is
 * never interrupted.
 */
export function PwaUpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg"
    >
      <p className="flex-1 text-sm">{t('pwa.updateAvailable')}</p>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        <RefreshCw className="size-4" />
        {t('pwa.reload')}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={t('common.close')}
        onClick={() => setNeedRefresh(false)}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

/** The browser's install event, which is not in the standard DOM typings yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * "Install app" button. Rendered only when the browser says the app can be installed
 * (Chromium browsers; not shown once installed, and never on browsers without the event).
 */
export function InstallAppButton() {
  const { t } = useTranslation()
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault() // keep the event so the button can trigger it later
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!installEvent) return null

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null) // the event can only be used once
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-10"
      title={t('pwa.install')}
      onClick={() => void install()}
    >
      <Download className="size-5" />
      <span className="sr-only md:not-sr-only">{t('pwa.install')}</span>
    </Button>
  )
}
