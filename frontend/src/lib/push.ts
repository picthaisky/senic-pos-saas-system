import { api, getStatus } from '@/lib/api'

// Web Push: notifications that arrive even when the app is closed. The service worker shows
// them (public/push-sw.js); this module manages this browser's subscription with the backend
// (docs/API_REFERENCE.md §8).

/**
 * - `unsupported`: this browser cannot do it, or no service worker is running (e.g. `npm run dev`)
 * - `unavailable`: the server has no push keys configured
 * - `blocked`: the user denied notifications for this site in the browser
 * - `off` / `on`: whether this browser is subscribed
 */
export type PushState = 'unsupported' | 'unavailable' | 'blocked' | 'off' | 'on'

function registration(): Promise<ServiceWorkerRegistration | undefined> {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return supported ? navigator.serviceWorker.getRegistration() : Promise.resolve(undefined)
}

/** Null when the server has push turned off. */
async function fetchPublicKey(): Promise<string | null> {
  try {
    const { data } = await api.get<{ publicKey: string }>('/push/public-key')
    return data.publicKey
  } catch (error) {
    if (getStatus(error) === 404) return null
    throw error
  }
}

/** VAPID keys travel as URL-safe base64; the browser wants the raw bytes. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function register(subscription: PushSubscription, language: string) {
  const { endpoint, keys } = subscription.toJSON()
  return api.post('/push/subscriptions', { endpoint, keys, language })
}

export async function getPushState(): Promise<PushState> {
  const reg = await registration()
  if (!reg) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if ((await fetchPublicKey()) === null) return 'unavailable'
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

/**
 * Asks the user for permission (the browser shows its prompt) and subscribes this browser.
 * Returns the resulting state; rejects only on an unexpected server or network error, in which
 * case nothing is left half-subscribed.
 */
export async function enablePush(language: string): Promise<PushState> {
  const reg = await registration()
  if (!reg) return 'unsupported'

  const publicKey = await fetchPublicKey()
  if (publicKey === null) return 'unavailable'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(publicKey),
  })
  try {
    await register(subscription, language)
  } catch (error) {
    // The server does not know this browser, so it would never get anything: undo.
    await subscription.unsubscribe()
    throw error
  }
  return 'on'
}

/**
 * Makes sure the server has this browser registered for the user who is signed in now.
 * Used at sign-in when the browser is already subscribed; safe to call repeatedly.
 */
export async function syncPush(language: string): Promise<void> {
  const subscription = await (await registration())?.pushManager.getSubscription()
  if (subscription) await register(subscription, language)
}

/**
 * Stops notifications on this browser. Call it before signing out (it needs the access token),
 * so the next person to use the device does not receive this user's alerts.
 */
export async function disablePush(): Promise<void> {
  const subscription = await (await registration())?.pushManager.getSubscription()
  if (!subscription) return
  try {
    await api.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } })
  } finally {
    // Even if the server could not be told, this browser stops listening.
    await subscription.unsubscribe()
  }
}
