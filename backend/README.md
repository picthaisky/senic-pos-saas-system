# Senic POS SaaS Backend API

## 📋 Overview

This is a comprehensive **Multi-Tenant POS SaaS Backend API** built with:
- **.NET 10** (C#)
- **Entity Framework Core 10**
- **PostgreSQL** (primary) / **SQL Server** (optional)
- **Clean Architecture** (Domain → Application → Infrastructure → API)
- **Repository Pattern** + **Service Layer**
- **RESTful API** with Swagger/OpenAPI
- **JWT Authentication** ready
- **Serilog** for logging
- **Docker** & **Kubernetes** support

## 🏗️ Project Structure

```
SenicPosSaaS/
├── SenicPosSaaS.Domain/           # Domain layer - Entities, Enums, Interfaces
│   ├── Common/
│   │   ├── BaseEntity.cs          # Base entity with common fields
│   │   └── TenantEntity.cs        # Multi-tenant base entity
│   ├── Entities/
│   │   ├── Order.cs               # Order entity
│   │   ├── OrderItem.cs           # Order line item
│   │   ├── InventoryItem.cs       # Product/inventory
│   │   ├── Customer.cs            # Customer profile
│   │   └── Subscription.cs        # Tenant subscription
│   ├── Enums/
│   │   ├── OrderStatus.cs
│   │   ├── PaymentMethod.cs
│   │   ├── SubscriptionStatus.cs
│   │   └── SubscriptionPlan.cs
│   └── Interfaces/
│       ├── IRepository.cs         # Generic repository interface
│       ├── IOrderRepository.cs
│       ├── IInventoryItemRepository.cs
│       ├── ICustomerRepository.cs
│       └── ISubscriptionRepository.cs
│
├── SenicPosSaaS.Application/      # Application layer - DTOs, Services
│   ├── DTOs/
│   │   ├── Order/
│   │   ├── InventoryItem/
│   │   ├── Customer/
│   │   └── Subscription/
│   ├── Interfaces/
│   │   ├── IOrderService.cs
│   │   ├── IInventoryItemService.cs
│   │   ├── ICustomerService.cs
│   │   └── ISubscriptionService.cs
│   └── Services/
│       ├── OrderService.cs
│       ├── InventoryItemService.cs
│       ├── CustomerService.cs
│       └── SubscriptionService.cs
│
├── SenicPosSaaS.Infrastructure/   # Infrastructure layer - Data access
│   ├── Data/
│   │   ├── ApplicationDbContext.cs # EF Core DbContext
│   │   └── DbInitializer.cs        # Seed data
│   └── Repositories/
│       ├── Repository.cs           # Generic repository implementation
│       ├── OrderRepository.cs
│       ├── InventoryItemRepository.cs
│       ├── CustomerRepository.cs
│       └── SubscriptionRepository.cs
│
├── SenicPosSaaS.API/              # Presentation layer - API Controllers
│   ├── Controllers/
│   │   ├── OrdersController.cs
│   │   ├── InventoryController.cs
│   │   ├── CustomersController.cs
│   │   ├── SubscriptionsController.cs
│   │   └── HealthController.cs
│   ├── Program.cs                 # Application entry point
│   └── appsettings.json           # Configuration
│
└── SenicPosSaaS.Tests/            # Unit tests
    ├── Services/
    │   └── InventoryItemServiceTests.cs
    └── Repositories/
        └── InventoryItemRepositoryTests.cs
```

## 🚀 Features

### Multi-Tenant Support
- Row-level isolation using `TenantId`
- Each tenant has isolated data
- Subscription-based access control

### Core Modules
1. **Orders Management** - Create, view, cancel orders
2. **Inventory Management** - CRUD operations, low stock alerts
3. **Customer Management** - Customer profiles, loyalty points
4. **Subscription Management** - Plans, renewals, expiry tracking

### Technical Features
- Async/await throughout
- LINQ queries with Entity Framework Core
- Dependency Injection (DI)
- Swagger/OpenAPI documentation
- Structured logging with Serilog
- Docker containerization
- Kubernetes deployment manifests
- Health check endpoints

## 📊 Database Schema

### Key Entities

**TenantEntity (Base for multi-tenant entities)**
- `Id` (Guid, PK)
- `TenantId` (Guid, Indexed)
- `CreatedAt`, `UpdatedAt`
- `CreatedBy`, `UpdatedBy`

**Order**
- `OrderNumber` (Unique)
- `CustomerId` (FK)
- `TotalAmount`, `DiscountAmount`, `TaxAmount`, `NetAmount`
- `Status` (Pending, Processing, Completed, Cancelled, Refunded)
- `PaymentMethod` (Cash, CreditCard, QRCode, etc.)
- `OrderItems` (Collection)

**InventoryItem**
- `Sku` (Unique per tenant)
- `Name`, `Description`, `Barcode`
- `Price`, `Cost`, `Quantity`, `MinimumStock`
- `Category`, `ImageUrl`, `IsActive`

**Customer**
- `FirstName`, `LastName`, `Email` (Unique per tenant)
- `Phone`, `Address`, `DateOfBirth`
- `LoyaltyPoints`, `IsActive`
- `Orders` (Collection)

**Subscription**
- `TenantId` (Unique), `TenantName`
- `Plan` (Basic, Pro, Enterprise)
- `Status` (Active, Inactive, Suspended, Cancelled, Expired)
- `StartDate`, `EndDate`, `MonthlyFee`
- `AutoRenew`

## 🔧 Setup & Installation

### Prerequisites
- .NET 10 SDK
- PostgreSQL 16+ or SQL Server 2019+
- Docker (optional)
- Kubernetes cluster (optional)

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd senic-pos-saas-system/backend
```

2. **Update connection string**
Edit `SenicPosSaaS.API/appsettings.json`:
```json
{
  "ConnectionStrings": {
    "PostgreSQL": "Host=localhost;Port=5432;Database=SenicPosDb;Username=postgres;Password=yourpassword"
  }
}
```

3. **Run the application**
```bash
cd SenicPosSaaS.API
dotnet run
```

In the Development environment the API applies the EF Core migrations and seeds demo data on
startup, so there is no separate migration step. To apply migrations yourself (any other
environment):
```bash
dotnet ef database update --project SenicPosSaaS.Infrastructure --startup-project SenicPosSaaS.API
```
After changing an entity, add a migration with
`dotnet ef migrations add <Name> --project SenicPosSaaS.Infrastructure`.
Migrations target PostgreSQL; the SQL Server option has none yet.

The API will be available at:
- `dotnet run`: `http://localhost:5247` (Swagger UI at `/swagger`)
- `docker-compose up`: `http://localhost:5000`

4. **Sign in**

Every endpoint except `/health` and `/api/auth/*` needs an access token. The Development seed
creates one user per role in the demo tenant `11111111-1111-1111-1111-111111111111`:
`admin@demo.test`, `owner@demo.test`, `cashier@demo.test` and `viewer@demo.test`.
Their password is the `Seed:DemoPassword` value in `SenicPosSaaS.API/appsettings.Development.json`.

In Swagger UI call `POST /api/auth/login`, copy `accessToken` from the response and paste it
into **Authorize**.

5. **Configuration outside Development**

| Setting | Purpose |
| --- | --- |
| `Jwt__Key` | Signing key for access tokens, at least 32 characters. Required: the API refuses to start without it. |
| `Cors__AllowedOrigins__0` | Origin of the frontend when it is served from a different origin than the API. |
| `Database__MigrateOnStartup` | `true` applies pending migrations when the API starts. For single-instance deployments only. |
| `Bootstrap__TenantId`, `Bootstrap__OwnerEmail`, `Bootstrap__OwnerPassword` | Creates the first Owner of a tenant that has no users yet (password 12+ characters). Remove the password afterwards. |
| `Business__TimeZone` | Time zone used for report days and date filters. Default `Asia/Bangkok`. |
| `Push__PublicKey`, `Push__PrivateKey` | VAPID key pair for push notifications. Optional: without them push is off and everything else works. |
| `Push__Subject` | Contact for the push services, e.g. `mailto:admin@your-domain`. Required with the keys. |

Generate the VAPID key pair once with `npx web-push generate-vapid-keys` and keep it: changing it
invalidates every existing subscription. In Development a temporary pair is generated on each start,
so browsers have to subscribe again after a restart unless you set real keys.

### Docker Deployment

1. **Build and run with Docker Compose**
```bash
cd backend
docker-compose up --build
```

This will start:
- PostgreSQL database on port 5432
- API on port 5000

2. **Access the API**
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger`

### Kubernetes Deployment

1. **Create namespace**
```bash
kubectl apply -f k8s/namespace.yaml
```

2. **Deploy PostgreSQL**
```bash
kubectl apply -f k8s/postgres.yaml
```

3. **Deploy API**
```bash
# Build and tag the Docker image
docker build -t senicpos-api:latest .

# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
```

4. **Check status**
```bash
kubectl get pods -n senicpos
kubectl get services -n senicpos
```

## 📡 API Endpoints

The full contract (request and response shapes, roles, status codes) is in
[`docs/API_REFERENCE.md`](../docs/API_REFERENCE.md). The tenant always comes from the access
token, never from the URL or the request body.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Inventory | `GET /api/inventory`, `GET /api/inventory/{id}`, `GET /api/inventory/barcode/{barcode}`, `GET /api/inventory/low-stock`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| Customers | `GET /api/customers`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/loyalty`, `POST /{id}/loyalty/earn`, `POST /{id}/loyalty/redeem` |
| Orders | `GET /api/orders`, `GET /{id}`, `POST`, `POST /{id}/cancel` |
| Dashboard | `GET /api/dashboard/summary` |
| Subscriptions | `GET /api/subscriptions/current`, `POST /api/subscriptions/current/renew`, `POST /api/subscriptions`, `GET /api/subscriptions/expiring` |
| Health | `GET /health` (no sign-in) |

## 🧪 Testing

```bash
dotnet test                                   # everything (needs Docker)
dotnet test --filter "Category!=Postgres"     # without Docker
```

- **Unit tests** (`Services/`, `Repositories/`): services and repositories in isolation.
- **API tests** (`Api/`): the real HTTP pipeline (authentication, roles, tenant isolation,
  business rules, SignalR, push) on an in-memory database.
- **PostgreSQL tests** (`Api/PostgresTests.cs`, category `Postgres`): the same API suites again
  on a real PostgreSQL started with Testcontainers and created from the migrations, plus
  concurrency tests (simultaneous sales, redemptions and duplicate submissions) that only a real
  database can show. They need a running Docker daemon.

## 📝 Sample API Requests

### Sign in
```bash
POST /api/auth/login
Content-Type: application/json

{
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "email": "cashier@demo.test",
  "password": "<Seed:DemoPassword>"
}
```
The response body carries `accessToken`; the refresh token is set as an HttpOnly cookie.

### Create Order
```bash
POST /api/orders
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "customerId": null,
  "paymentMethod": "Cash",
  "discountAmount": 0,
  "clientOrderId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "items": [
    { "inventoryItemId": "item-guid-here", "quantity": 2, "discount": 0 }
  ]
}
```

### Create Inventory Item
```bash
POST /api/inventory
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "sku": "DRINK-002",
  "name": "Lemon Soda",
  "barcode": "8850999320052",
  "price": 35,
  "cost": 12,
  "quantity": 100,
  "minimumStock": 20,
  "category": "Beverage"
}
```

## 🔐 Security Best Practices

1. **Multi-Tenant Isolation**
   - Always filter by `TenantId` in queries
   - Use row-level security policies
   - Validate tenant access in middleware

2. **Authentication & Authorization**
   - JWT tokens (implementation ready)
   - Role-based access control (RBAC)
   - API key validation for external integrations

3. **Data Protection**
   - Connection strings in environment variables
   - Secrets management with Kubernetes secrets
   - Encrypted data at rest and in transit

## 📈 Performance Considerations

- **Database Indexing**: All foreign keys and tenant IDs are indexed
- **Async/Await**: All I/O operations are asynchronous
- **Connection Pooling**: EF Core handles connection pooling
- **Caching**: Ready for Redis integration
- **Horizontal Scaling**: Kubernetes HPA configured

## 🔄 CI/CD Pipeline (Recommended)

```yaml
# Example GitHub Actions workflow
name: Build and Deploy

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup .NET
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: 10.0.x
    - name: Restore dependencies
      run: dotnet restore
    - name: Build
      run: dotnet build --no-restore
    - name: Test
      run: dotnet test --no-build --verbosity normal
    - name: Build Docker image
      run: docker build -t senicpos-api:${{ github.sha }} .
```

## 📚 Additional Resources

- [.NET 10 Documentation](https://learn.microsoft.com/en-us/dotnet/)
- [Entity Framework Core](https://learn.microsoft.com/en-us/ef/core/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For issues and questions:
- Create an issue in the repository
- Contact: support@senicpos.com
