# API Examples - Senic POS SaaS Backend

## 🔐 Base URL
- Development: `http://localhost:5000/api`
- Production: `https://api.senicpos.com/api`

## 📊 Sample Data

Use these sample IDs for testing:
- **Tenant ID**: `11111111-1111-1111-1111-111111111111`
- **Customer IDs**: Check `/api/customers/tenant/{tenantId}` response
- **Inventory Item IDs**: Check `/api/inventory/tenant/{tenantId}` response

---

## 📦 Inventory Management

### Create Inventory Item
```bash
POST /api/inventory
Content-Type: application/json

{
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "sku": "FOOD-005",
  "name": "Green Curry",
  "description": "Spicy Thai green curry with vegetables",
  "barcode": "8850999320052",
  "price": 180.00,
  "cost": 80.00,
  "quantity": 50,
  "minimumStock": 10,
  "category": "Main Course",
  "imageUrl": "https://example.com/images/green-curry.jpg"
}
```

**Response (201 Created)**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sku": "FOOD-005",
  "name": "Green Curry",
  "description": "Spicy Thai green curry with vegetables",
  "barcode": "8850999320052",
  "price": 180.00,
  "cost": 80.00,
  "quantity": 50,
  "minimumStock": 10,
  "category": "Main Course",
  "imageUrl": "https://example.com/images/green-curry.jpg",
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Get All Inventory Items
```bash
GET /api/inventory/tenant/11111111-1111-1111-1111-111111111111
```

**Response (200 OK)**:
```json
[
  {
    "id": "item-guid-1",
    "sku": "FOOD-001",
    "name": "Pad Thai",
    "description": "Traditional Thai stir-fried noodles",
    "barcode": "8850999320014",
    "price": 120.00,
    "cost": 50.00,
    "quantity": 100,
    "minimumStock": 20,
    "category": "Main Course",
    "imageUrl": null,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  {
    "id": "item-guid-2",
    "name": "Tom Yum Soup",
    "sku": "FOOD-002",
    // ...more items
  }
]
```

### Update Inventory Item
```bash
PUT /api/inventory/{id}
Content-Type: application/json

{
  "price": 190.00,
  "quantity": 75,
  "isActive": true
}
```

### Get Low Stock Items
```bash
GET /api/inventory/tenant/11111111-1111-1111-1111-111111111111/low-stock
```

---

## 👥 Customer Management

### Create Customer
```bash
POST /api/customers
Content-Type: application/json

{
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "firstName": "Somchai",
  "lastName": "Prayut",
  "email": "somchai.p@example.com",
  "phone": "+66-81-555-1234",
  "address": "123 Sukhumvit Road, Bangkok 10110",
  "dateOfBirth": "1990-05-15"
}
```

**Response (201 Created)**:
```json
{
  "id": "customer-guid",
  "firstName": "Somchai",
  "lastName": "Prayut",
  "fullName": "Somchai Prayut",
  "email": "somchai.p@example.com",
  "phone": "+66-81-555-1234",
  "address": "123 Sukhumvit Road, Bangkok 10110",
  "loyaltyPoints": 0,
  "dateOfBirth": "1990-05-15",
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Get Customer by ID
```bash
GET /api/customers/{id}
```

### Get All Customers for Tenant
```bash
GET /api/customers/tenant/11111111-1111-1111-1111-111111111111
```

### Add Loyalty Points
```bash
POST /api/customers/{id}/loyalty-points
Content-Type: application/json

{
  "points": 50
}
```

---

## 🛒 Orders Management

### Create Order
```bash
POST /api/orders
Content-Type: application/json

{
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "customerId": "customer-guid-here",
  "paymentMethod": 0,
  "discountAmount": 20.00,
  "notes": "Customer requested extra spicy",
  "items": [
    {
      "inventoryItemId": "item-guid-1",
      "quantity": 2,
      "discount": 0.00
    },
    {
      "inventoryItemId": "item-guid-2",
      "quantity": 1,
      "discount": 10.00
    },
    {
      "inventoryItemId": "item-guid-3",
      "quantity": 3,
      "discount": 0.00
    }
  ]
}
```

**Response (201 Created)**:
```json
{
  "id": "order-guid",
  "orderNumber": "ORD-20240115-ABC12345",
  "customerId": "customer-guid",
  "customerName": "Somchai Prayut",
  "totalAmount": 525.00,
  "discountAmount": 20.00,
  "taxAmount": 36.75,
  "netAmount": 541.75,
  "status": 0,
  "paymentMethod": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": null,
  "items": [
    {
      "id": "item-line-guid-1",
      "inventoryItemId": "item-guid-1",
      "itemName": "Pad Thai",
      "quantity": 2,
      "unitPrice": 120.00,
      "discount": 0.00,
      "subtotal": 240.00
    },
    {
      "id": "item-line-guid-2",
      "inventoryItemId": "item-guid-2",
      "itemName": "Tom Yum Soup",
      "quantity": 1,
      "unitPrice": 150.00,
      "discount": 10.00,
      "subtotal": 140.00
    },
    {
      "id": "item-line-guid-3",
      "inventoryItemId": "item-guid-3",
      "itemName": "Thai Iced Tea",
      "quantity": 3,
      "unitPrice": 45.00,
      "discount": 0.00,
      "subtotal": 135.00
    }
  ]
}
```

### Get Order by ID
```bash
GET /api/orders/{id}
```

### Get All Orders for Tenant
```bash
GET /api/orders/tenant/11111111-1111-1111-1111-111111111111
```

### Cancel Order
```bash
POST /api/orders/{id}/cancel
```

**Response (200 OK)**:
```json
{
  "message": "Order cancelled successfully"
}
```

---

## 💳 Subscription Management

### Create Subscription
```bash
POST /api/subscriptions
Content-Type: application/json

{
  "tenantId": "22222222-2222-2222-2222-222222222222",
  "tenantName": "My New Restaurant",
  "plan": 1,
  "startDate": "2024-01-15T00:00:00Z",
  "durationMonths": 12,
  "autoRenew": true
}
```

**Response (201 Created)**:
```json
{
  "id": "subscription-guid",
  "tenantId": "22222222-2222-2222-2222-222222222222",
  "tenantName": "My New Restaurant",
  "plan": 1,
  "status": 0,
  "startDate": "2024-01-15T00:00:00Z",
  "endDate": "2025-01-15T00:00:00Z",
  "monthlyFee": 599.00,
  "autoRenew": true,
  "daysUntilExpiry": 365
}
```

### Get Subscription by Tenant ID
```bash
GET /api/subscriptions/tenant/11111111-1111-1111-1111-111111111111
```

### Renew Subscription
```bash
POST /api/subscriptions/tenant/11111111-1111-1111-1111-111111111111/renew
```

### Get Expiring Subscriptions
```bash
GET /api/subscriptions/expiring?daysBeforeExpiry=30
```

**Response (200 OK)**:
```json
[
  {
    "id": "subscription-guid",
    "tenantId": "tenant-guid",
    "tenantName": "Restaurant ABC",
    "plan": 1,
    "status": 0,
    "startDate": "2023-12-15T00:00:00Z",
    "endDate": "2024-02-10T00:00:00Z",
    "monthlyFee": 599.00,
    "autoRenew": true,
    "daysUntilExpiry": 25
  }
]
```

---

## 🏥 Health Check

### Check API Health
```bash
GET /health
```

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

---

## 📋 Enumerations Reference

### Order Status
```
0 = Pending
1 = Processing
2 = Completed
3 = Cancelled
4 = Refunded
```

### Payment Method
```
0 = Cash
1 = CreditCard
2 = DebitCard
3 = QRCode
4 = BankTransfer
```

### Subscription Plan
```
0 = Basic (299 THB/month)
1 = Pro (599 THB/month)
2 = Enterprise (1,499 THB/month)
```

### Subscription Status
```
0 = Active
1 = Inactive
2 = Suspended
3 = Cancelled
4 = Expired
```

---

## 🔒 Error Responses

### 400 Bad Request
```json
{
  "error": "Customer not found"
}
```

### 404 Not Found
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.4",
  "title": "Not Found",
  "status": 404,
  "traceId": "00-trace-id-here"
}
```

### 500 Internal Server Error
```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.6.1",
  "title": "An error occurred while processing your request.",
  "status": 500,
  "traceId": "00-trace-id-here"
}
```

---

## 🧪 Testing with cURL

### Complete Order Flow Example

```bash
# 1. Get inventory items
curl -X GET "http://localhost:5000/api/inventory/tenant/11111111-1111-1111-1111-111111111111"

# 2. Get customers
curl -X GET "http://localhost:5000/api/customers/tenant/11111111-1111-1111-1111-111111111111"

# 3. Create order
curl -X POST "http://localhost:5000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "11111111-1111-1111-1111-111111111111",
    "customerId": "customer-id-from-step-2",
    "paymentMethod": 0,
    "discountAmount": 0,
    "items": [
      {
        "inventoryItemId": "item-id-from-step-1",
        "quantity": 2,
        "discount": 0
      }
    ]
  }'

# 4. Get created order
curl -X GET "http://localhost:5000/api/orders/order-id-from-step-3"

# 5. Check low stock items
curl -X GET "http://localhost:5000/api/inventory/tenant/11111111-1111-1111-1111-111111111111/low-stock"
```

---

## 📊 Swagger UI

Access interactive API documentation at:
- **URL**: `http://localhost:5000/swagger`
- Test all endpoints directly from browser
- View request/response schemas
- Try out API calls

---

## 🔗 Additional Resources

- See `README.md` for setup instructions
- See `ARCHITECTURE.md` for technical details
- See `DEPLOYMENT.md` for deployment guide
- API is fully RESTful following best practices
- All endpoints support `application/json`
- Date/time formats use ISO 8601 (UTC)
