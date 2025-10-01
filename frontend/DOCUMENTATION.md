# Senic POS SaaS - Frontend (Angular 20)

A modern, responsive Point of Sale (POS) SaaS system built with **Angular 20**, **Angular Material**, and **Tailwind CSS**.

## 🚀 Features

### Core Functionality
- ✅ **Multi-Tenant Architecture** - Separate data per tenant with role-based access control
- ✅ **Authentication & Authorization** - JWT-based authentication with role guards (Admin, Owner, Cashier, Viewer)
- ✅ **POS Sale Screen** - Full-featured point of sale with cart, barcode scanning, and payment processing
- ✅ **Inventory Management** - CRUD operations with filtering, pagination, and low stock alerts
- ✅ **Customer Loyalty** - Customer management with loyalty points tracking and transaction history
- ✅ **Analytics Dashboard** - Sales statistics, trends, and top products visualization
- ✅ **Offline-First** - IndexedDB integration for offline data storage
- ✅ **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- ✅ **Dark/Light Theme** - User-selectable theme with persistent preferences

### Technical Stack
- **Angular 20** - Latest Angular framework with standalone components
- **Angular Material** - Material Design components
- **Tailwind CSS v3** - Utility-first CSS framework
- **TypeScript** - Type-safe development
- **NgRx Signals** - Modern state management
- **RxJS** - Reactive programming
- **IndexedDB (idb)** - Client-side database for offline support

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/                      # Core functionality
│   │   │   ├── guards/                # Route guards
│   │   │   │   └── auth.guard.ts      # Authentication & role guards
│   │   │   ├── interceptors/          # HTTP interceptors
│   │   │   │   └── auth.interceptor.ts # JWT token interceptor
│   │   │   ├── models/                # Data models & interfaces
│   │   │   │   ├── auth.model.ts      # Authentication models
│   │   │   │   ├── customer.model.ts  # Customer & loyalty models
│   │   │   │   ├── inventory.model.ts # Inventory models
│   │   │   │   └── order.model.ts     # Order & cart models
│   │   │   └── services/              # Core services
│   │   │       ├── auth.service.ts    # Authentication service
│   │   │       ├── customer.service.ts # Customer API service
│   │   │       ├── inventory.service.ts # Inventory API service
│   │   │       ├── offline-storage.service.ts # IndexedDB service
│   │   │       ├── order.service.ts   # Order API service
│   │   │       └── theme.service.ts   # Theme management
│   │   │
│   │   ├── features/                  # Feature modules
│   │   │   ├── auth/
│   │   │   │   └── login/            # Login component
│   │   │   ├── pos/
│   │   │   │   └── sale-screen/      # POS sale screen
│   │   │   ├── inventory/
│   │   │   │   └── inventory-list/   # Inventory management
│   │   │   ├── customers/
│   │   │   │   └── customer-loyalty/ # Customer loyalty
│   │   │   └── analytics/
│   │   │       └── dashboard/        # Analytics dashboard
│   │   │
│   │   ├── shared/                    # Shared components
│   │   │   ├── components/
│   │   │   │   └── layout/           # Main layout with sidebar
│   │   │   ├── directives/           # Shared directives
│   │   │   └── pipes/                # Shared pipes
│   │   │
│   │   ├── store/                     # State management
│   │   │   └── cart.store.ts         # Cart state with Signals
│   │   │
│   │   ├── app.config.ts             # App configuration
│   │   ├── app.routes.ts             # Route definitions
│   │   └── app.ts                    # Root component
│   │
│   ├── environments/                  # Environment configurations
│   │   ├── environment.ts            # Development environment
│   │   └── environment.prod.ts       # Production environment
│   │
│   ├── styles.scss                   # Global styles
│   └── index.html                    # Main HTML file
│
├── angular.json                      # Angular CLI configuration
├── tailwind.config.js               # Tailwind CSS configuration
├── postcss.config.js                # PostCSS configuration
└── package.json                     # NPM dependencies
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Angular CLI 20.x

### Install Dependencies
```bash
cd frontend
npm install
```

### Development Server
```bash
npm start
# or
ng serve
```
Navigate to `http://localhost:4200/`

### Build for Production
```bash
npm run build
# or
ng build --configuration=production
```
Built files will be in `dist/frontend/`

### Run Tests
```bash
npm test
# or
ng test
```

## 📚 Component Documentation

### 1. Authentication (`features/auth/login`)
**Login Component** - Multi-tenant login with email, password, and tenant ID

**Features:**
- Reactive form validation
- Password visibility toggle
- Error message display
- Redirects to return URL after successful login

**Usage:**
```typescript
// Navigate to login
router.navigate(['/auth/login']);
```

### 2. POS Sale Screen (`features/pos/sale-screen`)
**POS Sale Screen Component** - Complete point of sale interface

**Features:**
- Product search and selection
- Barcode scanner integration
- Shopping cart management
- Real-time price calculations (subtotal, tax, discount, total)
- Multiple payment methods
- Order checkout

**Key Functionality:**
```typescript
// Add item to cart
addToCart(item: InventoryItem): void {
  this.cartStore.addItem({
    inventoryItemId: item.id,
    name: item.name,
    quantity: 1,
    price: item.price,
    discount: 0,
    total: item.price,
    imageUrl: item.imageUrl,
    availableQuantity: item.quantity
  });
}

// Checkout
checkout(): void {
  const orderDto: CreateOrderDto = {
    customerId: this.cartStore.selectedCustomerId() || undefined,
    items: this.cartStore.cartItems().map(item => ({
      inventoryItemId: item.inventoryItemId,
      quantity: item.quantity,
      discount: item.discount
    })),
    discount: this.cartStore.discount(),
    paymentMethod: this.cartStore.paymentMethod()
  };
  
  this.orderService.create(orderDto).subscribe({
    next: (order) => {
      // Order created successfully
      this.cartStore.clear();
    }
  });
}
```

### 3. Inventory Management (`features/inventory/inventory-list`)
**Inventory List Component** - Comprehensive inventory management

**Features:**
- CRUD operations (Create, Read, Update, Delete)
- Search and filter by name, SKU, category
- Sort by name, price, quantity
- Pagination support
- Low stock alerts
- Active/Inactive status

**API Integration:**
```typescript
// Load inventory with filters
loadInventory(): void {
  const filter = {
    search: this.searchTerm() || undefined,
    category: this.selectedCategory() || undefined,
    lowStock: this.showLowStock() || undefined
  };
  
  this.inventoryService.getAll(filter).subscribe({
    next: (items) => {
      this.dataSource.data = items;
    }
  });
}
```

### 4. Customer Loyalty (`features/customers/customer-loyalty`)
**Customer Loyalty Component** - Customer management with loyalty program

**Features:**
- Add new customers with validation
- View customer list with stats
- Customer details panel
- Loyalty points display
- Add/Redeem loyalty points
- Transaction history

**Loyalty Operations:**
```typescript
// Add loyalty points
addPoints(): void {
  this.customerService.addLoyaltyPoints(
    customerId, 
    points, 
    description
  ).subscribe({
    next: (updatedCustomer) => {
      // Points added successfully
    }
  });
}

// Redeem loyalty points
redeemPoints(): void {
  this.customerService.redeemLoyaltyPoints(
    customerId, 
    points, 
    description
  ).subscribe({
    next: (updatedCustomer) => {
      // Points redeemed successfully
    }
  });
}
```

### 5. Analytics Dashboard (`features/analytics/dashboard`)
**Dashboard Component** - Sales analytics and insights

**Features:**
- Total sales, orders, customers statistics
- Low stock alerts
- Sales trend visualization with progress bars
- Top products table
- Quick action buttons

**Dashboard Data:**
```typescript
interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  lowStockItems: number;
}

interface SalesData {
  date: string;
  sales: number;
  orders: number;
}
```

## 🔐 Authentication & Authorization

### Auth Service (Signals-based)
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signals for reactive state
  private currentUserSignal = signal<User | null>(null);
  private isAuthenticatedSignal = computed(() => !!this.currentUserSignal());
  
  // Public readonly signals
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = this.isAuthenticatedSignal;
  
  // Login
  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/login`, request)
      .pipe(tap(response => {
        this.setAuthData(response.user, response.token);
      }));
  }
  
  // Check roles
  hasRole(role: string): boolean {
    return this.currentUserSignal()?.role === role;
  }
  
  hasAnyRole(roles: string[]): boolean {
    const user = this.currentUserSignal();
    return user ? roles.includes(user.role) : false;
  }
}
```

### Route Guards
```typescript
// Auth Guard - Protects authenticated routes
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.isAuthenticated()) {
    return true;
  }
  
  router.navigate(['/auth/login'], { 
    queryParams: { returnUrl: state.url } 
  });
  return false;
};

// Role Guard - Protects routes by user role
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const requiredRoles = route.data['roles'] as string[];
  
  if (authService.hasAnyRole(requiredRoles)) {
    return true;
  }
  
  router.navigate(['/dashboard']);
  return false;
};
```

### Protected Routes Example
```typescript
export const routes: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [authGuard], // Must be authenticated
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/analytics/dashboard/dashboard')
      },
      {
        path: 'pos',
        loadComponent: () => import('./features/pos/sale-screen/sale-screen'),
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.Owner, UserRole.Cashier] }
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory/inventory-list/inventory-list'),
        canActivate: [roleGuard],
        data: { roles: [UserRole.Admin, UserRole.Owner] }
      }
    ]
  }
];
```

## 🗄️ State Management with Signals

### Cart Store Example
```typescript
@Injectable({ providedIn: 'root' })
export class CartStore {
  // Private signals for state
  private cartItemsSignal = signal<CartItem[]>([]);
  private discountSignal = signal<number>(0);
  
  // Public readonly signals
  readonly cartItems = this.cartItemsSignal.asReadonly();
  readonly discount = this.discountSignal.asReadonly();
  
  // Computed values
  readonly subtotal = computed(() => {
    return this.cartItemsSignal().reduce((sum, item) => sum + item.total, 0);
  });
  
  readonly total = computed(() => {
    return this.subtotal() - this.discountSignal() + this.taxAmount();
  });
  
  // Actions
  addItem(item: CartItem): void {
    this.cartItemsSignal.update(items => [...items, item]);
  }
  
  clear(): void {
    this.cartItemsSignal.set([]);
    this.discountSignal.set(0);
  }
}
```

### Using the Store in Components
```typescript
export class SaleScreen {
  constructor(public cartStore: CartStore) {}
  
  // Access reactive state
  get subtotal() {
    return this.cartStore.subtotal();
  }
  
  get items() {
    return this.cartStore.cartItems();
  }
}
```

## 💾 Offline Storage with IndexedDB

### Offline Storage Service
```typescript
@Injectable({ providedIn: 'root' })
export class OfflineStorageService {
  private db: IDBPDatabase<PosDB> | null = null;
  
  // Save order offline
  async saveOrder(order: any): Promise<void> {
    await this.db!.put('orders', order);
  }
  
  // Get offline orders
  async getOrders(): Promise<any[]> {
    return this.db!.getAll('orders');
  }
  
  // Save inventory items
  async saveInventoryItems(items: any[]): Promise<void> {
    const tx = this.db!.transaction('inventory', 'readwrite');
    await Promise.all(items.map(item => tx.store.put(item)));
    await tx.done;
  }
}
```

## 🎨 Theme Management

### Theme Service
```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeSignal = signal<Theme>('light');
  readonly theme = this.themeSignal.asReadonly();
  
  toggleTheme(): void {
    this.themeSignal.update(current => 
      current === 'light' ? 'dark' : 'light'
    );
  }
  
  constructor() {
    // Apply theme changes automatically
    effect(() => {
      const theme = this.themeSignal();
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(theme);
      localStorage.setItem('app_theme', theme);
    });
  }
}
```

### Using Theme in Layout
```html
<button mat-icon-button (click)="themeService.toggleTheme()">
  <mat-icon>
    {{ themeService.theme() === 'light' ? 'dark_mode' : 'light_mode' }}
  </mat-icon>
</button>
```

## 🌐 API Integration

### Environment Configuration
```typescript
// environment.ts (development)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000',
  offlineMode: false,
};

// environment.prod.ts (production)
export const environment = {
  production: true,
  apiUrl: 'https://api.senicpos.com',
  offlineMode: false,
};
```

### HTTP Interceptor (JWT)
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(cloned);
  }
  
  return next(req);
};
```

### Service Example
```typescript
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly API_URL = `${environment.apiUrl}/api/inventory`;
  
  constructor(private http: HttpClient) {}
  
  getAll(filter?: InventoryFilter): Observable<InventoryItem[]> {
    let params = new HttpParams();
    if (filter?.search) params = params.set('search', filter.search);
    if (filter?.category) params = params.set('category', filter.category);
    
    return this.http.get<InventoryItem[]>(this.API_URL, { params });
  }
  
  create(dto: CreateInventoryItemDto): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(this.API_URL, dto);
  }
}
```

## 🎯 Best Practices

### 1. Smart vs Presentational Components
- **Smart Components**: Handle business logic, API calls, state management
- **Presentational Components**: Focus on UI, receive data via @Input, emit events via @Output

### 2. Standalone Components
All components use standalone: true for better tree-shaking and lazy loading

### 3. Reactive Forms
Use Reactive Forms for complex form validation and control

### 4. Signal-based State
Use Angular Signals for reactive state management instead of RxJS BehaviorSubject where appropriate

### 5. Lazy Loading
All feature modules are lazy-loaded to reduce initial bundle size

### 6. Type Safety
Strict TypeScript configuration for better type safety

## 🚧 Future Enhancements

- [ ] PWA configuration (Service Worker, Manifest)
- [ ] Advanced analytics with Chart.js/ApexCharts
- [ ] Real-time updates with WebSocket
- [ ] Barcode scanner integration (camera/USB scanner)
- [ ] Receipt printing functionality
- [ ] Multi-language support (i18n)
- [ ] Export data (PDF, Excel)
- [ ] Advanced reporting module
- [ ] Settings & configuration page
- [ ] User management module
- [ ] Subscription billing integration

## 📝 API Endpoints Reference

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create new order
- `POST /api/orders/:id/cancel` - Cancel order

### Inventory
- `GET /api/inventory` - Get all inventory items (with filters)
- `GET /api/inventory/:id` - Get item by ID
- `POST /api/inventory` - Create new item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item
- `GET /api/inventory/barcode/:barcode` - Search by barcode
- `GET /api/inventory/low-stock` - Get low stock items

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/:id/loyalty` - Get loyalty transactions
- `POST /api/customers/:id/loyalty` - Add loyalty points
- `POST /api/customers/:id/loyalty/redeem` - Redeem loyalty points

## 📱 Responsive Design

The application is fully responsive with breakpoints:
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md, lg)
- **Desktop**: > 1024px (xl, 2xl)

Tailwind utility classes are used for responsive design:
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <!-- Responsive grid -->
</div>
```

## 🔍 Debugging

### Enable Source Maps
Source maps are enabled in development mode for easier debugging

### Angular DevTools
Install Angular DevTools Chrome extension for component inspection and profiling

### Network Inspection
All API calls can be inspected in browser DevTools Network tab

## 🤝 Contributing

1. Follow Angular style guide
2. Use meaningful commit messages
3. Write unit tests for new features
4. Update documentation
5. Ensure build passes before PR

## 📄 License

Copyright © 2024 Senic POS SaaS. All rights reserved.

---

**Built with ❤️ using Angular 20, Angular Material, and Tailwind CSS**
