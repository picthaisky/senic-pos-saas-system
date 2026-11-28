import { useQuery } from '@tanstack/react-query'
import { api, getStatus } from '@/lib/api'

// docs/API_REFERENCE.md §7.

export type SubscriptionPlan = 'Basic' | 'Pro' | 'Enterprise'
export type SubscriptionStatus = 'Active' | 'Inactive' | 'Suspended' | 'Cancelled' | 'Expired'

export interface Subscription {
  id: string
  tenantId: string
  tenantName: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  startDate: string
  endDate: string
  monthlyFee: number
  autoRenew: boolean
  /** Whole days left, counted by the server; negative once the end date has passed. */
  daysUntilExpiry: number
}

/** `null` when the shop has no subscription on record (the API answers 404). */
export function useSubscription() {
  return useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () =>
      api
        .get<Subscription>('/subscriptions/current')
        .then((r) => r.data)
        .catch((error: unknown) => {
          if (getStatus(error) === 404) return null
          throw error
        }),
  })
}
