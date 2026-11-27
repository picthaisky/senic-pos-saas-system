// Stands in for `virtual:pwa-register/react` in tests (see `test.alias` in vite.config.ts):
// there is no service worker under jsdom, so no update is ever pending.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: async () => {},
  }
}
