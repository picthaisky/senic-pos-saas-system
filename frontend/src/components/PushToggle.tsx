import { Bell, BellOff, BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import { env } from '@/lib/env'
import { disablePush, enablePush, getPushState, type PushState, syncPush } from '@/lib/push'
import { hasAnyRole, useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { toast } from '@/stores/toast'

/** The roles the server sends push notifications to (stock alerts). */
const RECIPIENT_ROLES = ['Admin', 'Owner'] as const

/**
 * Bell button that turns push notifications on or off for this browser. Shown only to users
 * who would receive something, and only where push can work: a supported browser, a running
 * service worker (a production build) and a server with push configured.
 */
export function PushToggle() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const online = useNetworkStore((state) => state.online)
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  const eligible = hasAnyRole(user, RECIPIENT_ROLES) && !env.useMocks
  const userId = user?.id

  useEffect(() => {
    if (!eligible || !online) return
    let cancelled = false
    void getPushState()
      .then(async (current) => {
        // Already subscribed on this browser: make sure it is registered to this user.
        if (current === 'on') await syncPush(i18n.language)
        if (!cancelled) setState(current)
      })
      .catch(() => {
        if (!cancelled) setState(null) // could not find out; show nothing rather than guess
      })
    return () => {
      cancelled = true
    }
  }, [eligible, online, userId, i18n.language])

  if (!eligible || state === null || state === 'unsupported' || state === 'unavailable') {
    return null
  }

  async function toggle() {
    if (state === 'blocked') {
      toast.info(t('push.blocked'))
      return
    }
    setBusy(true)
    try {
      if (state === 'on') {
        await disablePush()
        setState('off')
        toast.info(t('push.disabled'))
      } else {
        const next = await enablePush(i18n.language)
        setState(next)
        if (next === 'on') toast.success(t('push.enabled'))
        if (next === 'blocked') toast.info(t('push.blocked'))
      }
    } catch {
      toast.error(t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const Icon = state === 'on' ? BellRing : state === 'blocked' ? BellOff : Bell
  const label = state === 'on' ? t('push.turnOff') : t('push.turnOn')

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={state === 'on'}
      title={label}
      disabled={busy || !online}
      onClick={() => void toggle()}
    >
      <Icon className={state === 'on' ? 'size-5 text-primary' : 'size-5'} />
    </Button>
  )
}
