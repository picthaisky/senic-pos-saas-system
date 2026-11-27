import { QueryClient } from '@tanstack/react-query'
import { getStatus } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx never helps; retry once for network errors and 5xx.
      retry: (failureCount, error) => {
        const status = getStatus(error)
        if (status !== undefined && status >= 400 && status < 500) return false
        return failureCount < 1
      },
    },
  },
})

// Cached data belongs to one tenant and user; drop it whenever the session ends.
useAuthStore.subscribe((state, previous) => {
  if (previous.status === 'authenticated' && state.status === 'anonymous') queryClient.clear()
})
