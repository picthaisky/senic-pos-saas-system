# Angular Frontend Architecture

## Component Tree Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        App Component                         │
│                    (Router Outlet)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─ /auth/login
                              │    └─ Login Component
                              │
                              └─ / (Layout Component)
                                   ├─ Sidebar Navigation
                                   ├─ Top Toolbar
                                   │    ├─ Theme Toggle
                                   │    ├─ Notifications
                                   │    └─ User Menu
                                   │
                                   └─ Router Outlet (Main Content)
                                        │
                                        ├─ /dashboard
                                        │    └─ Dashboard Component
                                        │         ├─ Stats Cards
                                        │         ├─ Sales Chart
                                        │         └─ Top Products Table
                                        │
                                        ├─ /pos
                                        │    └─ POS Sale Screen Component
                                        │         ├─ Product Search Panel
                                        │         ├─ Barcode Scanner
                                        │         └─ Cart Panel
                                        │              ├─ Cart Items
                                        │              ├─ Order Summary
                                        │              └─ Checkout Button
                                        │
                                        ├─ /inventory
                                        │    └─ Inventory List Component
                                        │         ├─ Search & Filter Bar
                                        │         ├─ Data Table
                                        │         │    ├─ Sortable Columns
                                        │         │    └─ Action Buttons
                                        │         └─ Paginator
                                        │
                                        └─ /customers
                                             └─ Customer Loyalty Component
                                                  ├─ Add Customer Form
                                                  ├─ Customer List Table
                                                  └─ Customer Details Panel
                                                       ├─ Profile Info
                                                       ├─ Loyalty Points
                                                       ├─ Stats Cards
                                                       └─ Transaction History
```

## Data Flow Architecture

```
┌──────────────────┐
│   Components     │
│  (Presentation)  │
└────────┬─────────┘
         │ Uses
         ▼
┌──────────────────┐       ┌──────────────────┐
│    Services      │◄─────►│   Store/Signals  │
│  (Business Logic)│       │  (State Mgmt)    │
└────────┬─────────┘       └──────────────────┘
         │ HTTP Calls
         ▼
┌──────────────────┐       ┌──────────────────┐
│  HTTP Interceptor│◄─────►│  Auth Service    │
│  (Add JWT Token) │       │  (Token Storage) │
└────────┬─────────┘       └──────────────────┘
         │
         ▼
┌──────────────────┐       ┌──────────────────┐
│   Backend API    │       │   IndexedDB      │
│  (REST Endpoints)│       │  (Offline Store) │
└──────────────────┘       └──────────────────┘
```

## State Management Flow (Cart Example)

```
┌─────────────────────────────────────────────────────────┐
│                     Cart Store                          │
│                   (Signal-based)                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Private Signals:                                       │
│  ┌─────────────────────────────────────────┐          │
│  │ cartItemsSignal = signal<CartItem[]>([])│          │
│  │ discountSignal = signal<number>(0)      │          │
│  │ selectedCustomerIdSignal = signal(null) │          │
│  │ paymentMethodSignal = signal('Cash')    │          │
│  └─────────────────────────────────────────┘          │
│                       │                                 │
│                       ├─ Computed Values:               │
│                       │   ├─ subtotal()                 │
│                       │   ├─ taxAmount()                │
│                       │   ├─ total()                    │
│                       │   └─ itemCount()                │
│                       │                                 │
│                       └─ Actions:                       │
│                           ├─ addItem()                  │
│                           ├─ removeItem()               │
│                           ├─ updateQuantity()           │
│                           ├─ setDiscount()              │
│                           └─ clear()                    │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  POS Component    │
                    │  (Consumer)       │
                    └───────────────────┘
```

## Authentication Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Enter credentials
     ▼
┌─────────────────┐
│ Login Component │
└────┬────────────┘
     │ 2. Submit form
     ▼
┌─────────────────┐
│  Auth Service   │
└────┬────────────┘
     │ 3. POST /api/auth/login
     ▼
┌─────────────────┐
│  Backend API    │
└────┬────────────┘
     │ 4. Return JWT + User data
     ▼
┌─────────────────┐
│  Auth Service   │
│  - Save token   │
│  - Update signal│
└────┬────────────┘
     │ 5. Navigate to dashboard
     ▼
┌─────────────────┐
│ Auth Guard      │◄── All subsequent requests
│ (Check auth)    │    include JWT via interceptor
└─────────────────┘
```

## Role-Based Access Control

```
┌─────────────────────────────────────────────────────┐
│                    User Roles                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Admin:                                             │
│    ✓ All permissions                                │
│    ✓ User management                                │
│    ✓ System settings                                │
│                                                     │
│  Owner:                                             │
│    ✓ View all data for their tenant                │
│    ✓ Manage inventory                               │
│    ✓ Manage customers                               │
│    ✓ View reports                                   │
│    ✓ POS operations                                 │
│                                                     │
│  Cashier:                                           │
│    ✓ POS operations                                 │
│    ✓ View customer info                             │
│    ✓ Limited inventory view                         │
│                                                     │
│  Viewer:                                            │
│    ✓ Dashboard view                                 │
│    ✓ Read-only access to reports                   │
│                                                     │
└─────────────────────────────────────────────────────┘

Route Protection:
┌─────────────────────────────────────────────────────┐
│  Route          │  Roles Allowed                    │
├─────────────────────────────────────────────────────┤
│  /dashboard     │  All authenticated users          │
│  /pos           │  Admin, Owner, Cashier            │
│  /inventory     │  Admin, Owner                     │
│  /customers     │  Admin, Owner                     │
│  /reports       │  Admin, Owner, Viewer             │
└─────────────────────────────────────────────────────┘
```

## Service Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Core Services:                                         │
│  ┌──────────────────────────────────────────┐         │
│  │  AuthService                             │         │
│  │  - login()                               │         │
│  │  - logout()                              │         │
│  │  - getToken()                            │         │
│  │  - hasRole()                             │         │
│  │  - currentUser (signal)                  │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │  ThemeService                            │         │
│  │  - toggleTheme()                         │         │
│  │  - setTheme()                            │         │
│  │  - theme (signal)                        │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  Feature Services:                                      │
│  ┌──────────────────────────────────────────┐         │
│  │  InventoryService                        │         │
│  │  - getAll()                              │         │
│  │  - getById()                             │         │
│  │  - create()                              │         │
│  │  - update()                              │         │
│  │  - delete()                              │         │
│  │  - searchByBarcode()                     │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │  CustomerService                         │         │
│  │  - getAll()                              │         │
│  │  - create()                              │         │
│  │  - update()                              │         │
│  │  - getLoyaltyTransactions()              │         │
│  │  - addLoyaltyPoints()                    │         │
│  │  - redeemLoyaltyPoints()                 │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │  OrderService                            │         │
│  │  - create()                              │         │
│  │  - cancel()                              │         │
│  │  - printReceipt()                        │         │
│  └──────────────────────────────────────────┘         │
│                                                         │
│  ┌──────────────────────────────────────────┐         │
│  │  OfflineStorageService                   │         │
│  │  - saveOrder()                           │         │
│  │  - getOrders()                           │         │
│  │  - saveInventoryItems()                  │         │
│  │  - getInventoryItems()                   │         │
│  └──────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

## HTTP Interceptor Flow

```
Component makes HTTP request
         │
         ▼
┌─────────────────┐
│ Auth Interceptor│
│  - Get token    │
│  - Add to header│
└────────┬────────┘
         │ Authorization: Bearer <token>
         ▼
┌─────────────────┐
│   HTTP Client   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend API   │
│  - Validate JWT │
│  - Check roles  │
│  - Process req  │
└────────┬────────┘
         │
         ▼
    Response data
         │
         ▼
     Component
```

## Offline Support Architecture

```
┌────────────────────────────────────────────┐
│         Online/Offline Detection           │
└────────────────┬───────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│   Online     │   │   Offline    │
│   Mode       │   │   Mode       │
└──────┬───────┘   └──────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  Backend API │   │  IndexedDB   │
│              │   │  - orders    │
│  - GET data  │   │  - inventory │
│  - POST      │   │  - customers │
│  - PUT       │   │              │
│  - DELETE    │   │  Queue:      │
│              │   │  - Pending   │
│              │   │    operations│
└──────┬───────┘   └──────┬───────┘
       │                  │
       └────────┬─────────┘
                │
                ▼
        ┌───────────────┐
        │  Sync Service │
        │  - Queue ops  │
        │  - Retry      │
        │  - Merge data │
        └───────────────┘
```

## Module Loading Strategy

```
┌─────────────────────────────────────────┐
│           Initial Load                  │
│  - App Component                        │
│  - Router                               │
│  - Core Services                        │
│  - Layout Component (if authenticated)  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│        Lazy Loaded Modules              │
│  (Loaded on route navigation)           │
├─────────────────────────────────────────┤
│                                         │
│  /auth/login → Login Component          │
│  /dashboard → Dashboard Component       │
│  /pos → POS Sale Screen Component       │
│  /inventory → Inventory List Component  │
│  /customers → Customer Loyalty Component│
│                                         │
└─────────────────────────────────────────┘

Benefits:
✓ Reduced initial bundle size
✓ Faster initial load time
✓ Better code splitting
✓ Improved performance
```

## Responsive Design Breakpoints

```
┌─────────────────────────────────────────────────────┐
│                Screen Sizes                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Mobile (xs):     0px - 639px                       │
│  - Single column layout                             │
│  - Stacked cards                                    │
│  - Collapsed sidebar                                │
│  - Full-width tables with horizontal scroll        │
│                                                     │
│  Tablet (sm, md): 640px - 1023px                    │
│  - 2-column grid                                    │
│  - Collapsible sidebar                              │
│  - Responsive tables                                │
│                                                     │
│  Desktop (lg, xl): 1024px+                          │
│  - Multi-column grid (3-4 columns)                  │
│  - Fixed sidebar                                    │
│  - Full data tables                                 │
│                                                     │
└─────────────────────────────────────────────────────┘

Tailwind Classes:
- grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- hidden md:block
- flex-col md:flex-row
```

## Performance Optimization

```
Techniques Applied:
┌─────────────────────────────────────────────────────┐
│  1. Lazy Loading                                    │
│     - Feature modules loaded on demand              │
│     - Reduced initial bundle size                   │
│                                                     │
│  2. Change Detection Optimization                   │
│     - OnPush strategy for presentational components │
│     - Signal-based reactivity                       │
│                                                     │
│  3. Code Splitting                                  │
│     - Separate chunks per route                     │
│     - Vendor/common chunks                          │
│                                                     │
│  4. Tree Shaking                                    │
│     - Standalone components                         │
│     - ES modules                                    │
│                                                     │
│  5. Asset Optimization                              │
│     - Minification                                  │
│     - Compression                                   │
│     - Image optimization                            │
│                                                     │
│  6. Caching Strategy                                │
│     - Service Worker (future PWA)                   │
│     - HTTP cache headers                            │
│     - IndexedDB for offline                         │
└─────────────────────────────────────────────────────┘
```

## Error Handling Strategy

```
┌──────────────────────────────────────────┐
│         Error Handling Flow              │
├──────────────────────────────────────────┤
│                                          │
│  Component                               │
│      │                                   │
│      ├─ Try API call                     │
│      │                                   │
│      ▼                                   │
│  Service                                 │
│      │                                   │
│      ├─ HTTP Error?                      │
│      │   ├─ 401: Redirect to login       │
│      │   ├─ 403: Show permission error   │
│      │   ├─ 404: Show not found          │
│      │   └─ 500: Show server error       │
│      │                                   │
│      ▼                                   │
│  Error Handler                           │
│      │                                   │
│      ├─ Log error                        │
│      ├─ Show user notification           │
│      └─ Retry logic (if applicable)      │
│                                          │
└──────────────────────────────────────────┘
```

## Testing Strategy

```
┌─────────────────────────────────────────────────────┐
│              Testing Pyramid                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│                    ▲                                │
│                   ╱ ╲                               │
│                  ╱ E2E╲   End-to-End Tests          │
│                 ╱───────╲  (Protractor/Cypress)     │
│                ╱         ╲                          │
│               ╱Integration╲ Integration Tests       │
│              ╱─────────────╲ (Component + Service)  │
│             ╱               ╲                       │
│            ╱   Unit Tests    ╲ Unit Tests           │
│           ╱───────────────────╲ (Jasmine/Karma)     │
│          ╱                     ╲                    │
│         ╱                       ╲                   │
│        ─────────────────────────                    │
│                                                     │
│  Test Coverage:                                     │
│  - Services: Unit tests                             │
│  - Components: Unit + Integration                   │
│  - Guards: Unit tests                               │
│  - Pipes: Unit tests                                │
│  - E2E: Critical user flows                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Build & Deployment Pipeline

```
┌────────────────────────────────────────────┐
│          CI/CD Pipeline                    │
├────────────────────────────────────────────┤
│                                            │
│  1. Code Push                              │
│     │                                      │
│     ▼                                      │
│  2. Install Dependencies                   │
│     npm install                            │
│     │                                      │
│     ▼                                      │
│  3. Lint Code                              │
│     ng lint                                │
│     │                                      │
│     ▼                                      │
│  4. Run Tests                              │
│     ng test                                │
│     │                                      │
│     ▼                                      │
│  5. Build Production                       │
│     ng build --configuration=production    │
│     │                                      │
│     ▼                                      │
│  6. Deploy                                 │
│     ├─ Static hosting (Netlify/Vercel)    │
│     ├─ Docker container                    │
│     └─ Cloud platform (AWS/Azure/GCP)      │
│                                            │
└────────────────────────────────────────────┘
```

---

This architecture provides:
- ✅ Scalable and maintainable code structure
- ✅ Clear separation of concerns
- ✅ Type-safe development with TypeScript
- ✅ Modern reactive patterns with Signals
- ✅ Optimized performance
- ✅ Offline-first capabilities
- ✅ Role-based security
- ✅ Responsive design
