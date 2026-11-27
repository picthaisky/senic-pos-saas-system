import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { PwaUpdatePrompt } from '@/components/PwaPrompt'
import { Toaster } from '@/components/ui'
import { refreshSession } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { routes } from './router'

export function App() {
  const [router] = useState(() => createBrowserRouter(routes))
  const online = useNetworkStore((state) => state.online)
  const hasToken = useAuthStore((state) => state.accessToken !== null)

  // Restore the session from the refresh cookie. Until this settles the auth status is
  // 'loading' and RequireAuth shows a spinner instead of bouncing to the login page.
  // It runs again when the network returns to a session that was resumed offline (no token).
  useEffect(() => {
    if (hasToken || !online) return
    refreshSession().catch(() => {
      // Not signed in, or the server is unreachable: refreshSession already set the status.
    })
  }, [online, hasToken])

  // With no network at startup there is nothing to wait for.
  useEffect(() => {
    if (!online && useAuthStore.getState().status === 'loading') {
      const auth = useAuthStore.getState()
      if (!auth.resumeOffline()) auth.clearSession()
    }
  }, [online])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <PwaUpdatePrompt />
    </QueryClientProvider>
  )
}
