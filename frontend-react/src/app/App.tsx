import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui'
import { refreshSession } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { routes } from './router'

export function App() {
  const [router] = useState(() => createBrowserRouter(routes))

  // Restore the session from the refresh cookie. Until this settles the auth status is
  // 'loading' and RequireAuth shows a spinner instead of bouncing to the login page.
  useEffect(() => {
    refreshSession().catch(() => {
      // Not signed in: refreshSession already marked the session anonymous.
    })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
}
