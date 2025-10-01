# Architecture Documentation - Senic POS SaaS Backend

## 🏛️ Clean Architecture Overview

This project follows **Clean Architecture** principles with clear separation of concerns across four layers:

```
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
│  (Controllers, Middleware, Filters)                      │
│  Dependencies: ↓ Application, ↓ Infrastructure          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                     │
│  (EF Core, Repositories, External Services)              │
│  Dependencies: ↓ Application, ↓ Domain                  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  (Services, DTOs, Business Logic)                        │
│  Dependencies: ↓ Domain                                  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                     Domain Layer                         │
│  (Entities, Enums, Interfaces)                           │
│  Dependencies: None (Pure Business Logic)                │
└─────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. Domain Layer (Core)
**Purpose**: Contains enterprise business rules and entities

**Components**:
- **Entities**: Business objects (Order, Customer, InventoryItem, Subscription)
- **Enums**: Value objects (OrderStatus, PaymentMethod, SubscriptionPlan)
- **Interfaces**: Repository contracts (IOrderRepository, ICustomerRepository)
- **Value Objects**: Immutable types representing domain concepts

**Rules**:
- No dependencies on other layers
- Contains only pure business logic
- Framework-agnostic
- Highly testable

#### 2. Application Layer
**Purpose**: Contains application business rules and orchestrates domain objects

**Components**:
- **DTOs**: Data Transfer Objects for API communication
- **Service Interfaces**: IOrderService, IInventoryItemService
- **Service Implementations**: Business logic orchestration
- **Validators**: Input validation logic
- **Mappers**: Entity ↔ DTO mapping

**Rules**:
- Depends only on Domain layer
- Contains use cases and application workflows
- Coordinates between domain and infrastructure
- No UI or database concerns

#### 3. Infrastructure Layer
**Purpose**: Implements external concerns (database, external APIs)

**Components**:
- **DbContext**: Entity Framework Core database context
- **Repositories**: Data access implementations
- **External Services**: Payment gateways, email services
- **Migrations**: Database schema changes
- **Seed Data**: Initial data population

**Rules**:
- Implements interfaces from Domain and Application
- Contains EF Core configurations
- Handles external service integrations
- Technology-specific implementations

#### 4. API Layer (Presentation)
**Purpose**: Exposes application functionality via HTTP endpoints

**Components**:
- **Controllers**: REST API endpoints
- **Middleware**: Request/response pipeline
- **Filters**: Cross-cutting concerns
- **Startup Configuration**: DI, pipeline setup
- **DTOs Validation**: Request validation

**Rules**:
- Thin controllers (minimal logic)
- Delegates to Application services
- Handles HTTP concerns only
- API versioning and documentation

## 🔄 Request Flow

### Example: Create Order Flow

```
1. HTTP Request
   ↓
2. OrdersController.CreateOrder()
   - Validates request
   - Extracts tenant from token
   ↓
3. IOrderService.CreateOrderAsync()
   - Business logic validation
   - Inventory availability check
   - Price calculations
   ↓
4. IOrderRepository.AddAsync()
   - Saves to database
   - Transaction management
   ↓
5. DbContext.SaveChangesAsync()
   - Persists changes
   ↓
6. Response mapped to OrderDto
   ↓
7. HTTP Response (201 Created)
```

## 🏗️ Design Patterns

### 1. Repository Pattern
**Purpose**: Abstracts data access logic

```csharp
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(T entity);
}
```

**Benefits**:
- Decouples business logic from data access
- Easy to mock for testing
- Centralized data access logic
- Supports multiple data sources

### 2. Service Layer Pattern
**Purpose**: Encapsulates business logic

```csharp
public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(CreateOrderDto dto);
    Task<OrderDto?> GetOrderByIdAsync(Guid id);
}
```

**Benefits**:
- Separates concerns
- Reusable business logic
- Transaction boundaries
- Easy to test

### 3. Dependency Injection
**Purpose**: Loose coupling and testability

```csharp
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IOrderService, OrderService>();
```

**Benefits**:
- Loose coupling
- Easy to mock dependencies
- Simplified testing
- Better maintainability

### 4. Unit of Work (Implicit with EF Core)
**Purpose**: Manages transactions

```csharp
await _repository.AddAsync(entity);
await _repository.SaveChangesAsync(); // Commits transaction
```

## 🔒 Multi-Tenant Architecture

### Row-Level Isolation Strategy

Every tenant-specific entity inherits from `TenantEntity`:

```csharp
public abstract class TenantEntity : BaseEntity
{
    public Guid TenantId { get; set; }
}
```

### Tenant Isolation Mechanisms

1. **Query Filtering**
```csharp
var items = await _dbSet
    .Where(i => i.TenantId == tenantId)
    .ToListAsync();
```

2. **Index Optimization**
```csharp
entity.HasIndex(e => e.TenantId);
entity.HasIndex(e => new { e.TenantId, e.Sku }).IsUnique();
```

3. **Composite Unique Constraints**
```csharp
// SKU is unique per tenant, not globally
entity.HasIndex(e => new { e.TenantId, e.Sku }).IsUnique();
```

### Tenant Context Flow

```
1. User authenticates → JWT token with TenantId
2. Middleware extracts TenantId from token
3. TenantId injected into HttpContext
4. Controller reads TenantId from context
5. Service filters data by TenantId
6. Repository applies TenantId in queries
```

## 💾 Database Design

### Entity Relationships

```
Subscription (1) ←→ (1) Tenant
    ↓
Customer (N) ←→ (1) Tenant
    ↓
Order (N) ←→ (1) Customer
    ↓
OrderItem (N) ←→ (1) Order
    ↓
InventoryItem (1) ←→ (N) OrderItem
    ↓
Tenant (1) ←→ (N) InventoryItem
```

### Indexing Strategy

**Primary Indexes**:
- All primary keys (Guid)
- TenantId on all tenant entities

**Composite Indexes**:
- (TenantId, Email) for Customers
- (TenantId, Sku) for InventoryItems
- (TenantId, Barcode) for InventoryItems

**Performance Considerations**:
- Covering indexes for common queries
- Index selectivity analysis
- Query execution plan review

## 🔐 Security Architecture

### Authentication Flow

```
1. User Login → Credentials
2. Validate credentials
3. Generate JWT token with claims:
   - UserId
   - TenantId
   - Roles
   - Permissions
4. Return token to client
5. Client includes token in Authorization header
6. API validates token on each request
```

### Authorization Levels

1. **Tenant Isolation**: Row-level security via TenantId
2. **Role-Based Access**: Admin, Manager, Cashier, Viewer
3. **Permission-Based**: CRUD permissions per resource
4. **Resource-Level**: Owner-only access for specific records

### Security Best Practices

- ✅ HTTPS only in production
- ✅ JWT token expiration
- ✅ Refresh tokens for long sessions
- ✅ Password hashing (bcrypt/Argon2)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS protection (input validation)
- ✅ CSRF protection (for web clients)
- ✅ Rate limiting
- ✅ API versioning
- ✅ Audit logging

## 📊 Logging & Monitoring

### Logging Levels

```csharp
LogLevel.Trace     // Detailed diagnostic information
LogLevel.Debug     // Developer debugging information
LogLevel.Information // General information
LogLevel.Warning   // Unexpected events that don't stop execution
LogLevel.Error     // Errors and exceptions
LogLevel.Critical  // Critical failures
```

### Structured Logging with Serilog

```csharp
_logger.LogInformation(
    "Order {OrderNumber} created for Customer {CustomerId}",
    orderNumber,
    customerId
);
```

### Monitoring Metrics

- Request/Response times
- Database query performance
- Error rates
- CPU/Memory usage
- Active connections
- Cache hit rates

## 🚀 Performance Optimization

### Database Optimization

1. **Query Optimization**
   - Use indexes effectively
   - Avoid N+1 queries
   - Use `Include()` for eager loading
   - Use `AsNoTracking()` for read-only queries

2. **Connection Pooling**
   - EF Core manages connection pooling
   - Configure max pool size

3. **Batch Operations**
   - `AddRange()` for bulk inserts
   - `ExecuteSqlRaw()` for bulk updates

### API Optimization

1. **Async/Await**
   - All I/O operations are async
   - Improves throughput

2. **Response Compression**
   - Gzip compression middleware
   - Reduces payload size

3. **Caching**
   - Memory cache for frequent queries
   - Distributed cache (Redis) for scaling

## 🧪 Testing Strategy

### Unit Tests
- Test service logic in isolation
- Mock repository dependencies
- Fast execution
- High code coverage

### Integration Tests
- Test repository implementations
- Use in-memory database
- Test data access logic
- Validate EF Core configurations

### API Tests
- Test controller endpoints
- Use TestServer
- Validate HTTP responses
- Test authentication/authorization

### Test Coverage Goals
- Domain Layer: 90%+
- Application Layer: 85%+
- Infrastructure Layer: 70%+
- API Layer: 70%+

## 🔄 CI/CD Pipeline

### Build Pipeline

```
1. Checkout code
2. Restore NuGet packages
3. Build solution
4. Run unit tests
5. Run integration tests
6. Code analysis (SonarQube)
7. Build Docker image
8. Push to container registry
```

### Deployment Pipeline

```
1. Pull Docker image
2. Run database migrations
3. Deploy to staging
4. Run smoke tests
5. Deploy to production (Blue-Green)
6. Health check validation
7. Rollback if needed
```

## 📈 Scalability Considerations

### Horizontal Scaling
- Stateless API (scales easily)
- Kubernetes HPA configuration
- Load balancing (NGINX/Traefik)
- Session management (Redis)

### Database Scaling
- Read replicas for queries
- Sharding by TenantId
- Connection pooling
- Query caching

### Caching Strategy
- In-memory cache (short TTL)
- Distributed cache (Redis)
- CDN for static assets
- Database query cache

## 🔧 Configuration Management

### Environment-Specific Settings

- **Development**: Detailed logging, auto-migrations
- **Staging**: Production-like, test data
- **Production**: Minimal logging, manual migrations

### Secret Management

- Environment variables
- Azure Key Vault / AWS Secrets Manager
- Kubernetes Secrets
- Never commit secrets to Git

## 📚 Additional Best Practices

1. **Code Organization**
   - Feature folders within layers
   - Consistent naming conventions
   - SOLID principles

2. **Error Handling**
   - Global exception handler
   - Structured error responses
   - Detailed logging

3. **API Versioning**
   - URL versioning (/api/v1/, /api/v2/)
   - Header versioning
   - Backward compatibility

4. **Documentation**
   - Swagger/OpenAPI
   - README files
   - Architecture decision records (ADRs)

## 🔄 Future Enhancements

- [ ] GraphQL API support
- [ ] Event-driven architecture (message bus)
- [ ] CQRS pattern implementation
- [ ] Domain events
- [ ] Outbox pattern for reliability
- [ ] API gateway integration
- [ ] Service mesh (Istio)
- [ ] Advanced monitoring (Prometheus/Grafana)
- [ ] Distributed tracing (Jaeger)
- [ ] Feature flags
