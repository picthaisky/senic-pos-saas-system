import {
  History,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ShoppingCart,
  UserCog,
  Users,
} from 'lucide-react'
import { hasAnyRole, type Role, type User } from '@/stores/auth'

export interface NavItem {
  path: string
  labelKey:
    'nav.dashboard' | 'nav.pos' | 'nav.inventory' | 'nav.customers' | 'nav.users' | 'nav.audit'
  icon: LucideIcon
  /** Roles allowed to open the page; omitted means every signed-in user. */
  roles?: readonly Role[]
}

/**
 * Single source for the sidebar menu and the route guards in router.tsx. The roles mirror what
 * the API allows (docs/API_REFERENCE.md): a page is only offered to roles whose requests the
 * API will accept.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    roles: ['Admin', 'Owner', 'Viewer'],
  },
  { path: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, roles: ['Admin', 'Owner', 'Cashier'] },
  { path: '/inventory', labelKey: 'nav.inventory', icon: Package, roles: ['Admin', 'Owner'] },
  { path: '/customers', labelKey: 'nav.customers', icon: Users, roles: ['Admin', 'Owner'] },
  { path: '/users', labelKey: 'nav.users', icon: UserCog, roles: ['Admin', 'Owner'] },
  { path: '/audit', labelKey: 'nav.audit', icon: History, roles: ['Admin', 'Owner'] },
]

/** The app root. It redirects each user to their own start page (see `startPathFor`). */
export const HOME_PATH = '/'
export const LOGIN_PATH = '/auth/login'

/** The first page in the menu that the user may open: Dashboard for most, POS for a cashier. */
export function startPathFor(user: User | null): string {
  return NAV_ITEMS.find((item) => hasAnyRole(user, item.roles))?.path ?? LOGIN_PATH
}
