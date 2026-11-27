# Quick Start Guide - Senic POS SaaS Backend

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Docker Desktop installed and running
- No other services running on ports 5000 or 5432

### Step 1: Clone and Navigate
```bash
git clone <repository-url>
cd senic-pos-saas-system/backend
```

### Step 2: Start with Docker Compose
```bash
docker-compose up -d
```

This starts:
- PostgreSQL database (port 5432)
- Backend API (port 5000)
- Auto-creates database with seed data

### Step 3: Verify It's Running
```bash
# Check health
curl http://localhost:5000/health

# Expected response:
# {"status":"healthy","timestamp":"2024-01-15T10:30:00Z","version":"1.0.0"}
```

### Step 4: Explore the API
Open your browser and go to:
```
http://localhost:5000/swagger
```

You'll see interactive API documentation where you can test all endpoints!

## 📋 Try It Out

### 1. View Sample Data
The database comes pre-seeded with:
- 1 Demo Tenant
- 2 Sample Customers
- 4 Sample Products

**Get Inventory Items**:
```bash
curl http://localhost:5000/api/inventory/tenant/11111111-1111-1111-1111-111111111111
```

**Get Customers**:
```bash
curl http://localhost:5000/api/customers/tenant/11111111-1111-1111-1111-111111111111
```

### 2. Create a New Product
```bash
curl -X POST http://localhost:5000/api/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "sku": "DRINK-002",
    "name": "Coffee",
    "description": "Hot black coffee",
    "price": 60.00,
    "cost": 20.00,
    "quantity": 100,
    "minimumStock": 20,
    "category": "Beverage"
  }'
```

### 3. Create an Order
First, note the customer ID and item IDs from step 1, then:

```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "customerId": "<customer-id-from-step-1>",
    "paymentMethod": 0,
    "discountAmount": 0,
    "items": [
      {
        "inventoryItemId": "<item-id-from-step-1>",
        "quantity": 2,
        "discount": 0
      }
    ]
  }'
```

The API will:
- ✅ Calculate totals and tax (7%)
- ✅ Deduct inventory
- ✅ Generate order number
- ✅ Return complete order details

## 🎯 What You Get

### Core Features
- ✅ Multi-tenant POS system
- ✅ Order management with automatic calculations
- ✅ Inventory tracking with low stock alerts
- ✅ Customer management with loyalty points
- ✅ Subscription management

### Architecture
- ✅ Clean Architecture (4 layers)
- ✅ Repository pattern
- ✅ Service layer with business logic
- ✅ RESTful API with Swagger docs
- ✅ Entity Framework Core with PostgreSQL

### Development Tools
- ✅ Hot reload enabled
- ✅ Structured logging (Serilog)
- ✅ Health check endpoints
- ✅ Unit tests (8 tests, 100% passing)

## 📚 Next Steps

### Explore the Documentation
- `README.md` - Full project overview
- `ARCHITECTURE.md` - Technical architecture details
- `API_EXAMPLES.md` - Complete API examples
- `DATABASE_SCHEMA.md` - Database design
- `DEPLOYMENT.md` - Production deployment guide

### Customize for Your Needs
1. **Add Authentication**: JWT implementation is ready
2. **Add More Entities**: Follow the same pattern (Domain → Application → Infrastructure)
3. **Add Business Rules**: Extend service layer
4. **Add Integrations**: Payment gateways, notifications, etc.

### Deploy to Production
See `DEPLOYMENT.md` for:
- Kubernetes deployment
- Cloud provider setup (Azure/AWS/GCP)
- Security configuration
- Monitoring setup

## 🛑 Stop the Services
```bash
# Stop containers
docker-compose down

# Stop and remove data (fresh start)
docker-compose down -v
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Stop docker-compose and try again
docker-compose down
docker-compose up -d
```

### Database Connection Failed
```bash
# Check logs
docker-compose logs postgres
docker-compose logs senicpos-api

# Restart services
docker-compose restart
```

### API Returns 500 Error
```bash
# View API logs
docker-compose logs -f senicpos-api

# Check database is running
docker-compose ps
```

## 💡 Tips

1. **Use Swagger UI** - Easiest way to test APIs: `http://localhost:5000/swagger`
2. **Check Logs** - All logs are in `/app/logs` inside container
3. **Sample Tenant ID** - Use `11111111-1111-1111-1111-111111111111` for testing
4. **Hot Reload** - Code changes rebuild automatically in development
5. **Database GUI** - Connect pgAdmin to `localhost:5432` for visual access

## 📞 Get Help

- Check logs: `docker-compose logs -f`
- View database: Connect to PostgreSQL on `localhost:5432`
  - Username: `postgres`
  - Password: `postgres`
  - Database: `SenicPosDb`
- Review API docs: `http://localhost:5000/swagger`
- Open an issue on GitHub

## ✅ Success Indicators

You know everything is working when:
1. ✅ Health endpoint returns `{"status":"healthy"}`
2. ✅ Swagger UI loads successfully
3. ✅ Sample data is visible in API responses
4. ✅ You can create orders and see inventory deduct
5. ✅ All 8 unit tests pass

## 🎉 Congratulations!

You now have a fully functional multi-tenant POS SaaS backend API running!

Explore the features, check out the code organization, and customize it for your needs.

---

**Built with ❤️ using .NET 10, Clean Architecture, and best practices**
