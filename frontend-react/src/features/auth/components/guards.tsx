import { Navigate, Outlet, useLocation } from 'react-router'
import { LOGIN_PATH } from '@/app/navigation'
import { PageSpinner } from '@/components/ui'
import { hasAnyRole, type Role, useAuthStore } from '@/stores/auth'
import { ForbiddenPage } from '../pages/ForbiddenPage'

/** Renders child routes for signed-in users; everyone else goes to the login page. */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen">
        <PageSpinner />
      </div>
    )
  }

  if (status === 'anonymous') {
    const returnUrl = location.pathname + location.search
    return <Navigate to={`${LOGIN_PATH}?returnUrl=${encodeURIComponent(returnUrl)}`} replace />
  }

  return <Outlet />
}

/** Must be nested inside RequireAuth. Shows the "access denied" page for other roles. */
export function RequireRole({ roles }: { roles?: readonly Role[] }) {
  const user = useAuthStore((state) => state.user)
  return hasAnyRole(user, roles) ? <Outlet /> : <ForbiddenPage />
}
