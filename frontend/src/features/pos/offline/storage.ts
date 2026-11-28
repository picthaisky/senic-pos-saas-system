import { create } from 'zustand'

// By default a browser may delete a site's stored data when the device runs low on space, and
// some do after a period without visits. Queued sales live in that storage, so the app asks the
// browser to keep it ("persistent storage"). The browser may refuse; the queue then says so and
// offers the export instead.

/** 'unknown' = not asked yet, or the browser has no way to tell. */
export type StorageProtection = 'persistent' | 'best-effort' | 'unknown'

export const useStorageProtection = create<{ protection: StorageProtection }>(() => ({
  protection: 'unknown',
}))

/**
 * Asks the browser to keep this site's data. Safe to call repeatedly; never throws. Chromium
 * and Safari decide silently, Firefox asks the user.
 */
export async function protectStorage(): Promise<StorageProtection> {
  let protection: StorageProtection = 'unknown'
  try {
    const storage = navigator.storage as StorageManager | undefined
    if (storage?.persist) {
      const persistent = (await storage.persisted?.()) || (await storage.persist())
      protection = persistent ? 'persistent' : 'best-effort'
    }
  } catch {
    // Storage access can be blocked altogether (private windows, strict settings).
  }
  useStorageProtection.setState({ protection })
  return protection
}
