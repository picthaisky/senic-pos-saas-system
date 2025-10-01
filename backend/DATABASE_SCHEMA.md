# Database Schema - Senic POS SaaS Backend

## 📊 Entity Relationship Diagram (ERD)

```
┌─────────────────────────┐
│      Subscription       │
│─────────────────────────│
│ Id (PK)                 │
│ TenantId (UNIQUE)       │◄──┐
│ TenantName              │   │
│ Plan                    │   │
│ Status                  │   │
│ StartDate               │   │
│ EndDate                 │   │
│ MonthlyFee              │   │
│ AutoRenew               │   │
│ PaymentReference        │   │
│ LastPaymentDate         │   │
│ CreatedAt, UpdatedAt    │   │
└─────────────────────────┘   │
                              │
                              │ 1:N (Tenant)
                              │
┌─────────────────────────┐   │
│       Customer          │   │
│─────────────────────────│   │
│ Id (PK)                 │   │
│ TenantId (FK) ──────────┼───┘
│ FirstName               │
│ LastName                │
│ Email (UNIQUE)          │
│ Phone                   │
│ Address                 │
│ LoyaltyPoints           │
│ DateOfBirth             │
│ IsActive                │
│ CreatedAt, UpdatedAt    │
└─────────────────────────┘
            │
            │ 1:N
            │
            ▼
┌─────────────────────────┐
│         Order           │
│─────────────────────────│
│ Id (PK)                 │
│ TenantId (FK)           │
│ OrderNumber (UNIQUE)    │
│ CustomerId (FK) ────────┤
│ TotalAmount             │
│ DiscountAmount          │
│ TaxAmount               │
│ NetAmount               │
│ Status                  │
│ PaymentMethod           │
│ CompletedAt             │
│ Notes                   │
│ CreatedAt, UpdatedAt    │
└─────────────────────────┘
            │
            │ 1:N
            │
            ▼
┌─────────────────────────┐
│       OrderItem         │
│─────────────────────────│
│ Id (PK)                 │
│ OrderId (FK) ───────────┤
│ InventoryItemId (FK) ───┼───┐
│ Quantity                │   │
│ UnitPrice               │   │
│ Discount                │   │
│ Subtotal                │   │
│ CreatedAt, UpdatedAt    │   │
└─────────────────────────┘   │
                              │
                              │
                              ▼
┌─────────────────────────┐
│     InventoryItem       │
│─────────────────────────│
│ Id (PK)                 │
│ TenantId (FK)           │
│ Sku (UNIQUE per tenant) │
│ Name                    │
│ Description             │
│ Barcode (UNIQUE)        │
│ Price                   │
│ Cost                    │
│ Quantity                │
│ MinimumStock            │
│ Category                │
│ ImageUrl                │
│ IsActive                │
│ CreatedAt, UpdatedAt    │
└─────────────────────────┘
```

## 📋 Table Definitions

### 1. Subscriptions
Multi-tenant subscription management.

```sql
CREATE TABLE "Subscriptions" (
    "Id" UUID PRIMARY KEY,
    "TenantId" UUID NOT NULL UNIQUE,
    "TenantName" VARCHAR(200) NOT NULL,
    "Plan" INTEGER NOT NULL,
    "Status" INTEGER NOT NULL,
    "StartDate" TIMESTAMP NOT NULL,
    "EndDate" TIMESTAMP NOT NULL,
    "MonthlyFee" DECIMAL(18,2) NOT NULL,
    "AutoRenew" BOOLEAN NOT NULL DEFAULT TRUE,
    "PaymentReference" VARCHAR(100),
    "LastPaymentDate" TIMESTAMP,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP,
    "CreatedBy" VARCHAR(255),
    "UpdatedBy" VARCHAR(255)
);

CREATE INDEX "IX_Subscriptions_TenantId" ON "Subscriptions" ("TenantId");
```

**Sample Data**:
```sql
INSERT INTO "Subscriptions" VALUES (
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Demo Restaurant',
    1, -- Pro Plan
    0, -- Active
    '2024-01-01',
    '2025-01-01',
    599.00,
    TRUE,
    NULL,
    NULL,
    NOW(),
    NULL,
    'system',
    NULL
);
```

### 2. Customers
Customer profiles with loyalty points.

```sql
CREATE TABLE "Customers" (
    "Id" UUID PRIMARY KEY,
    "TenantId" UUID NOT NULL,
    "FirstName" VARCHAR(100) NOT NULL,
    "LastName" VARCHAR(100) NOT NULL,
    "Email" VARCHAR(200) NOT NULL,
    "Phone" VARCHAR(20),
    "Address" VARCHAR(500),
    "LoyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "DateOfBirth" TIMESTAMP,
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP,
    "CreatedBy" VARCHAR(255),
    "UpdatedBy" VARCHAR(255)
);

CREATE INDEX "IX_Customers_TenantId" ON "Customers" ("TenantId");
CREATE UNIQUE INDEX "IX_Customers_TenantId_Email" ON "Customers" ("TenantId", "Email");
```

**Sample Data**:
```sql
INSERT INTO "Customers" VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'John',
    'Doe',
    'john.doe@example.com',
    '+66-81-234-5678',
    '123 Main St, Bangkok',
    150,
    '1990-05-15',
    TRUE,
    NOW(),
    NULL,
    'system',
    NULL
);
```

### 3. InventoryItems
Product/inventory management.

```sql
CREATE TABLE "InventoryItems" (
    "Id" UUID PRIMARY KEY,
    "TenantId" UUID NOT NULL,
    "Sku" VARCHAR(50) NOT NULL,
    "Name" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "Barcode" VARCHAR(50),
    "Price" DECIMAL(18,2) NOT NULL,
    "Cost" DECIMAL(18,2) NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "MinimumStock" INTEGER NOT NULL,
    "Category" VARCHAR(100),
    "ImageUrl" VARCHAR(500),
    "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP,
    "CreatedBy" VARCHAR(255),
    "UpdatedBy" VARCHAR(255)
);

CREATE INDEX "IX_InventoryItems_TenantId" ON "InventoryItems" ("TenantId");
CREATE UNIQUE INDEX "IX_InventoryItems_TenantId_Sku" ON "InventoryItems" ("TenantId", "Sku");
CREATE UNIQUE INDEX "IX_InventoryItems_TenantId_Barcode" ON "InventoryItems" ("TenantId", "Barcode");
```

**Sample Data**:
```sql
INSERT INTO "InventoryItems" VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'FOOD-001',
    'Pad Thai',
    'Traditional Thai stir-fried noodles',
    '8850999320014',
    120.00,
    50.00,
    100,
    20,
    'Main Course',
    NULL,
    TRUE,
    NOW(),
    NULL,
    'system',
    NULL
);
```

### 4. Orders
Sales orders with line items.

```sql
CREATE TABLE "Orders" (
    "Id" UUID PRIMARY KEY,
    "TenantId" UUID NOT NULL,
    "OrderNumber" VARCHAR(50) NOT NULL UNIQUE,
    "CustomerId" UUID NOT NULL,
    "TotalAmount" DECIMAL(18,2) NOT NULL,
    "DiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "TaxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "NetAmount" DECIMAL(18,2) NOT NULL,
    "Status" INTEGER NOT NULL,
    "PaymentMethod" INTEGER NOT NULL,
    "CompletedAt" TIMESTAMP,
    "Notes" TEXT,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP,
    "CreatedBy" VARCHAR(255),
    "UpdatedBy" VARCHAR(255),
    CONSTRAINT "FK_Orders_Customers" FOREIGN KEY ("CustomerId") 
        REFERENCES "Customers" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_Orders_TenantId" ON "Orders" ("TenantId");
CREATE INDEX "IX_Orders_CustomerId" ON "Orders" ("CustomerId");
CREATE INDEX "IX_Orders_CreatedAt" ON "Orders" ("CreatedAt");
CREATE UNIQUE INDEX "IX_Orders_OrderNumber" ON "Orders" ("OrderNumber");
```

### 5. OrderItems
Order line items.

```sql
CREATE TABLE "OrderItems" (
    "Id" UUID PRIMARY KEY,
    "OrderId" UUID NOT NULL,
    "InventoryItemId" UUID NOT NULL,
    "Quantity" INTEGER NOT NULL,
    "UnitPrice" DECIMAL(18,2) NOT NULL,
    "Discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "Subtotal" DECIMAL(18,2) NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP,
    "CreatedBy" VARCHAR(255),
    "UpdatedBy" VARCHAR(255),
    CONSTRAINT "FK_OrderItems_Orders" FOREIGN KEY ("OrderId") 
        REFERENCES "Orders" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_OrderItems_InventoryItems" FOREIGN KEY ("InventoryItemId") 
        REFERENCES "InventoryItems" ("Id") ON DELETE RESTRICT
);

CREATE INDEX "IX_OrderItems_OrderId" ON "OrderItems" ("OrderId");
CREATE INDEX "IX_OrderItems_InventoryItemId" ON "OrderItems" ("InventoryItemId");
```

## 🔍 Key Indexes

### Performance Indexes
```sql
-- Tenant filtering (most critical)
CREATE INDEX "IX_Orders_TenantId" ON "Orders" ("TenantId");
CREATE INDEX "IX_Customers_TenantId" ON "Customers" ("TenantId");
CREATE INDEX "IX_InventoryItems_TenantId" ON "InventoryItems" ("TenantId");

-- Date-based queries
CREATE INDEX "IX_Orders_CreatedAt" ON "Orders" ("CreatedAt");
CREATE INDEX "IX_Orders_CompletedAt" ON "Orders" ("CompletedAt") WHERE "CompletedAt" IS NOT NULL;

-- Unique constraints (tenant-scoped)
CREATE UNIQUE INDEX "IX_Customers_TenantId_Email" ON "Customers" ("TenantId", "Email");
CREATE UNIQUE INDEX "IX_InventoryItems_TenantId_Sku" ON "InventoryItems" ("TenantId", "Sku");
CREATE UNIQUE INDEX "IX_InventoryItems_TenantId_Barcode" ON "InventoryItems" ("TenantId", "Barcode");
```

## 📈 Common Queries

### Get Orders for a Tenant
```sql
SELECT o.*, c."FirstName", c."LastName"
FROM "Orders" o
INNER JOIN "Customers" c ON o."CustomerId" = c."Id"
WHERE o."TenantId" = '11111111-1111-1111-1111-111111111111'
ORDER BY o."CreatedAt" DESC
LIMIT 50;
```

### Get Low Stock Items
```sql
SELECT *
FROM "InventoryItems"
WHERE "TenantId" = '11111111-1111-1111-1111-111111111111'
  AND "Quantity" <= "MinimumStock"
  AND "IsActive" = TRUE
ORDER BY "Quantity" ASC;
```

### Get Order with Items
```sql
SELECT 
    o.*,
    json_agg(
        json_build_object(
            'id', oi."Id",
            'itemName', i."Name",
            'quantity', oi."Quantity",
            'unitPrice', oi."UnitPrice",
            'subtotal', oi."Subtotal"
        )
    ) as items
FROM "Orders" o
LEFT JOIN "OrderItems" oi ON o."Id" = oi."OrderId"
LEFT JOIN "InventoryItems" i ON oi."InventoryItemId" = i."Id"
WHERE o."Id" = 'order-guid-here'
GROUP BY o."Id";
```

### Get Expiring Subscriptions
```sql
SELECT *
FROM "Subscriptions"
WHERE "Status" = 0
  AND "EndDate" <= CURRENT_DATE + INTERVAL '30 days'
  AND "EndDate" >= CURRENT_DATE
ORDER BY "EndDate" ASC;
```

## 🔒 Data Constraints

### Business Rules
1. **Multi-Tenant Isolation**: All tenant-scoped tables have `TenantId`
2. **SKU Uniqueness**: SKU is unique per tenant (not globally)
3. **Email Uniqueness**: Email is unique per tenant
4. **Order Numbers**: Globally unique order numbers
5. **Inventory Tracking**: Quantity decremented on order creation
6. **Soft Deletes**: Use `IsActive` flag instead of hard deletes

### Referential Integrity
- Orders → Customers (RESTRICT): Cannot delete customer with orders
- OrderItems → Orders (CASCADE): Deleting order removes items
- OrderItems → InventoryItems (RESTRICT): Cannot delete item in orders

## 💾 Storage Estimates

### Table Size Projections (1 Year)

Assuming 1 tenant with:
- 500 customers
- 1000 inventory items
- 10,000 orders/month (120,000/year)
- Average 3 items per order (360,000 order items)

```
Customers:        500 × 0.5 KB  = 0.25 MB
InventoryItems:   1,000 × 1 KB  = 1 MB
Orders:           120,000 × 1 KB = 120 MB
OrderItems:       360,000 × 0.3 KB = 108 MB
Subscriptions:    1 × 0.5 KB    = 0.0005 MB

Total:            ~230 MB per tenant per year
```

For 100 tenants: ~23 GB/year (without indexes)

## 🔄 Database Maintenance

### Regular Tasks

**Daily**:
```sql
-- Analyze query performance
ANALYZE "Orders";
ANALYZE "OrderItems";
```

**Weekly**:
```sql
-- Reindex for performance
REINDEX TABLE "Orders";
REINDEX TABLE "OrderItems";
```

**Monthly**:
```sql
-- Vacuum to reclaim space
VACUUM ANALYZE;
```

## 🛡️ Security Considerations

1. **Row-Level Security**: Implement RLS policies for tenant isolation
2. **Connection Pooling**: Limit max connections per tenant
3. **Query Timeouts**: Set statement timeout to prevent long queries
4. **Encryption**: Enable TDE (Transparent Data Encryption)
5. **Audit Logging**: Track all data modifications

### Example Row-Level Security Policy
```sql
-- Enable RLS
ALTER TABLE "Orders" ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON "Orders"
    USING ("TenantId" = current_setting('app.current_tenant_id')::UUID);
```

## 📊 Monitoring Queries

### Check Table Sizes
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Index Usage
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Slow Query Analysis
```sql
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## 🔧 Database Configuration

### Recommended PostgreSQL Settings

```ini
# Memory Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 16MB

# Connection Settings
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# Query Optimization
random_page_cost = 1.1
effective_io_concurrency = 200
```

## 📝 Notes

- All timestamps are stored in UTC
- Decimal precision: (18,2) for currency
- GUIDs used for primary keys (distributed system friendly)
- Audit fields: CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
- Soft deletes using IsActive flag where applicable
