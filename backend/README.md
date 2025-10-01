# Senic POS SaaS Backend API

## 📋 Overview

This is a comprehensive **Multi-Tenant POS SaaS Backend API** built with:
- **.NET 9** (C#)
- **Entity Framework Core 9**
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
- .NET 9 SDK
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
  },
  "UsePostgreSQL": true
}
```

3. **Run migrations**
```bash
cd SenicPosSaaS.API
dotnet ef migrations add InitialCreate --project ../SenicPosSaaS.Infrastructure
dotnet ef database update --project ../SenicPosSaaS.Infrastructure
```

4. **Run the application**
```bash
dotnet run
```

The API will be available at:
- HTTP: `http://localhost:5000`
- HTTPS: `https://localhost:5001`
- Swagger UI: `http://localhost:5000/swagger`

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

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order by ID
- `GET /api/orders/tenant/{tenantId}` - Get all orders for tenant
- `POST /api/orders/{id}/cancel` - Cancel order

### Inventory
- `POST /api/inventory` - Create inventory item
- `GET /api/inventory/{id}` - Get item by ID
- `GET /api/inventory/tenant/{tenantId}` - Get all items for tenant
- `PUT /api/inventory/{id}` - Update item
- `DELETE /api/inventory/{id}` - Delete item
- `GET /api/inventory/tenant/{tenantId}/low-stock` - Get low stock items

### Customers
- `POST /api/customers` - Create customer
- `GET /api/customers/{id}` - Get customer by ID
- `GET /api/customers/tenant/{tenantId}` - Get all customers for tenant
- `POST /api/customers/{id}/loyalty-points` - Add loyalty points

### Subscriptions
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/tenant/{tenantId}` - Get subscription by tenant
- `POST /api/subscriptions/tenant/{tenantId}/renew` - Renew subscription
- `GET /api/subscriptions/expiring?daysBeforeExpiry=30` - Get expiring subscriptions

### Health
- `GET /health` - Health check endpoint

## 🧪 Testing

Run all tests:
```bash
dotnet test
```

Run tests with coverage:
```bash
dotnet test --collect:"XPlat Code Coverage"
```

## 📝 Sample API Requests

### Create Order
```bash
POST /api/orders
Content-Type: application/json

{
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "customerId": "customer-guid-here",
  "paymentMethod": 0,
  "discountAmount": 10.00,
  "items": [
    {
      "inventoryItemId": "item-guid-here",
      "quantity": 2,
      "discount": 5.00
    }
  ]
}
```

### Create Inventory Item
```bash
POST /api/inventory
Content-Type: application/json

{
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "sku": "FOOD-001",
  "name": "Pad Thai",
  "description": "Traditional Thai stir-fried noodles",
  "barcode": "8850999320014",
  "price": 120.00,
  "cost": 50.00,
  "quantity": 100,
  "minimumStock": 20,
  "category": "Main Course"
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
        dotnet-version: 9.0.x
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

- [.NET 9 Documentation](https://learn.microsoft.com/en-us/dotnet/)
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
