// Push notification handlers, loaded into the generated service worker through
// `workbox.importScripts` in vite.config.ts. Plain JavaScript: this file is served as-is.
//
// The server sends JSON: { title, body, tag, url } (see PushSubscriptionService on the backend).

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  // A push must always show a notification, or the browser shows a generic one and may
  // eventually revoke the permission.
  event.waitUntil(
    self.registration.showNotification(data.title || 'Senic POS', {
      body: data.body || '',
      // Same tag = a newer alert about the same thing replaces the older one.
      tag: data.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Only ever open a page of this app, whatever the payload said.
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  if (target.origin !== self.location.origin) return

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse an open window of the app if there is one.
      const existing = windows.find((client) => new URL(client.url).origin === target.origin)
      if (existing) {
        return existing.focus().then((client) => (client.navigate ? client.navigate(target.href) : client))
      }
      return self.clients.openWindow(target.href)
    }),
  )
})
