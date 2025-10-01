import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { UserRole } from './core/models/auth.model';
import { Layout } from './shared/components/layout/layout';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/analytics/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/sale-screen/sale-screen').then(m => m.SaleScreen),
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.Owner, UserRole.Cashier] }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory/inventory-list/inventory-list').then(m => m.InventoryList),
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.Owner] }
      },
      {
        path: 'customers',
        loadComponent: () => import('./features/customers/customer-loyalty/customer-loyalty').then(m => m.CustomerLoyalty),
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.Owner] }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
