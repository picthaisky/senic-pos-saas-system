import type { ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageSpinner } from '@/components/ui'
import { RequireAuth, RequireRole, StartRedirect } from '@/features/auth/components/guards'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { HOME_PATH, LOGIN_PATH, NAV_ITEMS } from './navigation'

// Each page is its own chunk, downloaded the first time the route is opened.
const pages: Record<string, () => Promise<{ Component: ComponentType }>> = {
  '/dashboard': () =>
    import('@/features/dashboard/pages/DashboardPage').then((m) => ({
      Component: m.DashboardPage,
    })),
  '/pos': () => import('@/features/pos/pages/PosPage').then((m) => ({ Component: m.PosPage })),
  '/inventory': () =>
    import('@/features/inventory/pages/InventoryPage').then((m) => ({
      Component: m.InventoryPage,
    })),
  '/customers': () =>
    import('@/features/customers/pages/CustomersPage').then((m) => ({
      Component: m.CustomersPage,
    })),
  '/users': () =>
    import('@/features/users/pages/UsersPage').then((m) => ({ Component: m.UsersPage })),
}

// Exported as plain route objects so tests can mount them in a memory router.
export const routes: RouteObject[] = [
  {
    // Shown while the first page chunk downloads.
    hydrateFallbackElement: (
      <div className="flex min-h-screen">
        <PageSpinner />
      </div>
    ),
    children: [
      { path: LOGIN_PATH, element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <StartRedirect /> },
              ...NAV_ITEMS.map((item) => ({
                element: <RequireRole roles={item.roles} />,
                children: [{ path: item.path, lazy: pages[item.path] }],
              })),
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to={HOME_PATH} replace /> },
    ],
  },
]
