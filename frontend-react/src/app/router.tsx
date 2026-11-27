import { Navigate, type RouteObject } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth, RequireRole } from '@/features/auth/components/guards'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { HOME_PATH, LOGIN_PATH, NAV_ITEMS } from './navigation'
import { PlaceholderPage } from './PlaceholderPage'

// Exported as plain route objects so tests can mount them in a memory router.
export const routes: RouteObject[] = [
  { path: LOGIN_PATH, element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to={HOME_PATH} replace /> },
          // Phase 3 swaps each placeholder for the real (lazy-loaded) page.
          ...NAV_ITEMS.map((item) => ({
            element: <RequireRole roles={item.roles} />,
            children: [{ path: item.path, element: <PlaceholderPage titleKey={item.labelKey} /> }],
          })),
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to={HOME_PATH} replace /> },
]
