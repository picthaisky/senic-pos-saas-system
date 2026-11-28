import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isNetworkError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { VatMode } from './pricing'

// docs/API_REFERENCE.md, "การตั้งค่าร้าน".

export interface ShopSettings {
  shopName: string
  address: string | null
  phone: string | null
  /** 13 digits. */
  taxId: string | null
  branch: string | null
  vatMode: VatMode
  vatRatePercent: number
  /** One point per this many baht paid; 0 = sales earn no points. */
  bahtPerPoint: number
  /** Baht off a bill per point used; 0 = points cannot be used as a discount. */
  pointValueBaht: number
  receiptFooter: string | null
}

/** What the API answers for a shop that has saved nothing yet. */
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: '',
  address: null,
  phone: null,
  taxId: null,
  branch: null,
  vatMode: 'None',
  vatRatePercent: 7,
  bahtPerPoint: 0,
  pointValueBaht: 0,
  receiptFooter: null,
}

// The till must price a sale while offline, so the last settings seen are kept on the device.
// They are not secret: every signed-in user of the shop may read them.
const storageKey = (tenantId: string) => `senic.shop-settings.${tenantId}`

function remembered(tenantId: string | undefined): ShopSettings | undefined {
  if (!tenantId) return undefined
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    return raw ? { ...DEFAULT_SHOP_SETTINGS, ...(JSON.parse(raw) as ShopSettings) } : undefined
  } catch {
    return undefined
  }
}

function remember(tenantId: string | undefined, settings: ShopSettings) {
  if (tenantId) localStorage.setItem(storageKey(tenantId), JSON.stringify(settings))
}

export const shopApi = {
  get: () => api.get<ShopSettings>('/shop-settings').then((r) => r.data),
  update: (settings: ShopSettings) =>
    api.put<ShopSettings>('/shop-settings', settings).then((r) => r.data),
}

export const SHOP_SETTINGS_KEY = ['shop-settings'] as const

/**
 * The shop's settings. While the server cannot be reached, the copy kept on this device
 * answers; a device that never saw them gets the defaults.
 */
export function useShopSettings() {
  const tenantId = useAuthStore((state) => state.user?.tenantId)
  return useQuery({
    queryKey: [...SHOP_SETTINGS_KEY, tenantId],
    queryFn: async () => {
      try {
        const settings = await shopApi.get()
        remember(tenantId, settings)
        return settings
      } catch (error) {
        const kept = remembered(tenantId)
        if (isNetworkError(error) && kept) return kept
        throw error
      }
    },
    // Offline too: then the kept copy is the answer.
    networkMode: 'always',
    initialData: () => remembered(tenantId),
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  })
}

export function useSaveShopSettings() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore((state) => state.user?.tenantId)
  return useMutation({
    mutationFn: shopApi.update,
    onSuccess: (settings) => {
      remember(tenantId, settings)
      queryClient.setQueryData([...SHOP_SETTINGS_KEY, tenantId], settings)
      void queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
