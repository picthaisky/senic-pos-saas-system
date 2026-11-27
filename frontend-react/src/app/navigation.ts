import { LayoutDashboard, type LucideIcon, Package, ShoppingCart, Users } from 'lucide-react'
import type { Role } from '@/stores/auth'

export interface NavItem {
  path: string
  labelKey: 'nav.dashboard' | 'nav.pos' | 'nav.inventory' | 'nav.customers'
  icon: LucideIcon
  /** Roles allowed to open the page; omitted means every signed-in user. */
  roles?: readonly Role[]
}

/** Single source for the sidebar menu and the route guards in router.tsx. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, roles: ['Admin', 'Owner', 'Cashier'] },
  { path: '/inventory', labelKey: 'nav.inventory', icon: Package, roles: ['Admin', 'Owner'] },
  { path: '/customers', labelKey: 'nav.customers', icon: Users, roles: ['Admin', 'Owner'] },
]

export const HOME_PATH = '/dashboard'
export const LOGIN_PATH = '/auth/login'
