# API Contract v1 – Senic POS

เอกสารนี้เป็นข้อตกลงระหว่าง frontend (React, `frontend-react/`) กับ backend (.NET, `backend/`)
คอลัมน์ **สถานะ** บอกว่า backend ปัจจุบันต้องทำอะไรเพื่อให้ตรงตาม contract นี้

- ✅ มีแล้ว ใช้ได้ทันที
- ✏️ มีแล้ว แต่ต้องแก้
- ➕ ยังไม่มี ต้องเพิ่ม

## 1. ข้อตกลงร่วม

| เรื่อง           | ข้อตกลง                                                                                                    | สถานะ backend                                    |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Base path      | ทุก endpoint อยู่ใต้ `/api`                                                                                   | ✅                                               |
| รูปแบบข้อมูล      | JSON, ชื่อ field เป็น camelCase                                                                              | ✅                                               |
| Enum           | ส่งเป็น string เช่น `"Cash"`, `"Completed"`                                                                  | ✏️ ตอนนี้เป็นตัวเลข ต้องเพิ่ม `JsonStringEnumConverter` |
| วันที่            | ISO 8601 UTC เช่น `2026-11-27T08:30:00Z`                                                                   | ✅                                               |
| Tenant         | อ่านจาก claim `tenantId` ใน JWT เท่านั้น ไม่รับจาก URL หรือ body                                                 | ✏️ ตอนนี้รับจาก URL และ body                        |
| Authentication | `Authorization: Bearer <accessToken>` ทุก endpoint ยกเว้น `/api/auth/login`, `/api/auth/refresh`, `/health` | ➕ ยังไม่มี JWT                                     |
| Error          | RFC 7807 `ProblemDetails` (`title`, `status`, `detail`, `errors`)                                         | ✏️ ต้องตรวจให้ทุก controller คืนรูปแบบเดียวกัน          |
| CORS           | อนุญาตเฉพาะ origin ของ frontend และ `AllowCredentials`                                                     | ✏️ ตอนนี้เป็น `AllowAnyOrigin`                      |

Status code ที่ frontend จัดการ: `400` (validation, แสดงใต้ field จาก `errors`), `401` (ลอง refresh 1 ครั้ง
ถ้าไม่ผ่านให้กลับหน้า login), `403` (ไม่มีสิทธิ์), `404`, `409` (เช่น stock ไม่พอ, SKU ซ้ำ)

## 2. Authentication ➕

Role ที่ใช้: `Admin`, `Owner`, `Cashier`, `Viewer`

| Method | Path                | คำอธิบาย             |
| ------ | ------------------- | ------------------- |
| POST   | `/api/auth/login`   | เข้าสู่ระบบ            |
| POST   | `/api/auth/refresh` | ขอ access token ใหม่ |
| POST   | `/api/auth/logout`  | ยกเลิก refresh token |
| GET    | `/api/auth/me`      | ข้อมูลผู้ใช้ปัจจุบัน        |

```jsonc
// POST /api/auth/login  request
{ "tenantId": "guid", "email": "cashier@shop.com", "password": "..." }

// 200 response (ใช้รูปแบบเดียวกันกับ /refresh)
{
  "accessToken": "jwt",
  "expiresAt": "2026-11-27T08:45:00Z",
  "user": { "id": "guid", "email": "...", "name": "...", "tenantId": "guid", "role": "Cashier" }
}
```

- Access token อายุ 15 นาที มี claim `sub`, `tenantId`, `role` frontend เก็บไว้ใน memory เท่านั้น
- Refresh token อายุ 7 วัน ส่งเป็น cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`
  และหมุน (rotate) ทุกครั้งที่เรียก `/refresh` frontend ไม่เห็นค่า token นี้
- ต้องเพิ่ม entity `User` (email, passwordHash, name, role, tenantId) และ seed ผู้ใช้ทดสอบ

## 3. Inventory

| Method | Path                                                   | Role         | สถานะ                                                                               |
| ------ | ------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------- |
| GET    | `/api/inventory?search=&category=&isActive=&lowStock=` | ทุก role      | ✏️ แทน `GET /tenant/{tenantId}` และเพิ่ม filter                                       |
| GET    | `/api/inventory/{id}`                                  | ทุก role      | ✅                                                                                  |
| GET    | `/api/inventory/barcode/{barcode}`                     | ทุก role      | ➕ repository มี `GetByBarcodeAsync` แล้ว เหลือ service และ controller คืน `404` ถ้าไม่พบ |
| GET    | `/api/inventory/low-stock`                             | Admin, Owner | ✏️ แทน `GET /tenant/{tenantId}/low-stock`                                           |
| POST   | `/api/inventory`                                       | Admin, Owner | ✏️ เอา `tenantId` ออกจาก body                                                       |
| PUT    | `/api/inventory/{id}`                                  | Admin, Owner | ✅                                                                                  |
| DELETE | `/api/inventory/{id}`                                  | Admin, Owner | ✅                                                                                  |

```jsonc
// InventoryItem
{
  "id": "guid",
  "sku": "SKU-001",
  "name": "...",
  "description": null,
  "barcode": "885...",
  "price": 120.0,
  "cost": 80.0,
  "quantity": 25,
  "minimumStock": 5,
  "category": "Drinks",
  "imageUrl": null,
  "isActive": true,
  "createdAt": "...",
}
```

Frontend เปลี่ยนมาใช้ชื่อ field ของ backend: `minimumStock` (เดิมใช้ `minQuantity`)

## 4. Customers

| Method | Path                                 | Role                  | สถานะ                                                  |
| ------ | ------------------------------------ | --------------------- | ------------------------------------------------------ |
| GET    | `/api/customers?search=`             | ทุก role               | ✏️ แทน `GET /tenant/{tenantId}`                        |
| GET    | `/api/customers/{id}`                | ทุก role               | ✅                                                     |
| POST   | `/api/customers`                     | Admin, Owner, Cashier | ✏️ เอา `tenantId` ออกจาก body, `email` ไม่บังคับ          |
| PUT    | `/api/customers/{id}`                | Admin, Owner          | ➕                                                     |
| DELETE | `/api/customers/{id}`                | Admin, Owner          | ➕                                                     |
| GET    | `/api/customers/{id}/loyalty`        | ทุก role               | ➕ ประวัติแต้ม ต้องเพิ่ม entity `LoyaltyTransaction`         |
| POST   | `/api/customers/{id}/loyalty/earn`   | Admin, Owner, Cashier | ✏️ แทน `POST /{id}/loyalty-points` และรับ `description` |
| POST   | `/api/customers/{id}/loyalty/redeem` | Admin, Owner, Cashier | ➕ คืน `409` ถ้าแต้มไม่พอ                                  |

```jsonc
// Customer
{
  "id": "guid", "firstName": "...", "lastName": "...", "fullName": "...",
  "email": null, "phone": "08...", "address": null, "dateOfBirth": null,
  "loyaltyPoints": 120, "isActive": true, "createdAt": "..."
}

// POST .../loyalty/earn และ .../loyalty/redeem  request → คืน Customer ที่อัปเดตแล้ว
{ "points": 50, "description": "..." }

// LoyaltyTransaction
{ "id": "guid", "customerId": "guid", "type": "Earned", "points": 50, "orderId": null,
  "description": "...", "createdAt": "..." }
```

Frontend เปลี่ยนมาใช้ `firstName` และ `lastName` (เดิมใช้ `name` field เดียว)
ส่วน `totalSpent` และ `visitCount` ที่หน้าจอเดิมแสดง backend ยังไม่มี จึงตัดออกจาก v1

## 5. Orders

| Method | Path                            | Role                  | สถานะ                                       |
| ------ | ------------------------------- | --------------------- | ------------------------------------------- |
| GET    | `/api/orders?from=&to=&status=` | Admin, Owner, Viewer  | ✏️ แทน `GET /tenant/{tenantId}`             |
| GET    | `/api/orders/{id}`              | ทุก role               | ✅                                          |
| POST   | `/api/orders`                   | Admin, Owner, Cashier | ✏️ ดูด้านล่าง                                  |
| POST   | `/api/orders/{id}/cancel`       | Admin, Owner          | ✅                                          |
| GET    | `/api/orders/{id}/receipt`      | ทุก role               | ➕ คืน `application/pdf` (เลื่อนไปทำหลัง v1 ได้) |

```jsonc
// POST /api/orders  request
{
  "customerId": null,              // null = ลูกค้าทั่วไป (walk-in)
  "paymentMethod": "Cash",         // Cash | CreditCard | DebitCard | QRCode | BankTransfer
  "discountAmount": 0,
  "notes": null,
  "clientOrderId": "guid",         // frontend สร้างเอง ใช้กัน order ซ้ำตอน sync จาก offline
  "items": [{ "inventoryItemId": "guid", "quantity": 2, "discount": 0 }]
}

// Order
{
  "id": "guid", "orderNumber": "...", "customerId": null, "customerName": "",
  "totalAmount": 240.0, "discountAmount": 0, "taxAmount": 16.8, "netAmount": 256.8,
  "status": "Completed", "paymentMethod": "Cash", "createdAt": "...", "completedAt": "...",
  "items": [{ "id": "guid", "inventoryItemId": "guid", "itemName": "...", "quantity": 2,
              "unitPrice": 120.0, "discount": 0, "subtotal": 240.0 }]
}
```

สิ่งที่ backend ต้องแก้ใน `POST /api/orders`

- เอา `tenantId` ออกจาก body
- `customerId` ต้องเป็น nullable (ตอนนี้เป็น `Guid` บังคับ จึงขายให้ลูกค้าทั่วไปไม่ได้)
- รับ `clientOrderId` และคืน order เดิมถ้าเคยรับค่านี้แล้ว (idempotent)

Frontend เปลี่ยนมาใช้ชื่อ field ของ backend: `totalAmount`, `netAmount`, `discountAmount`, `itemName`,
`unitPrice` ยอดเงินทุกตัวให้ยึดค่าที่ backend คำนวณ ตะกร้าใน frontend แสดงเป็นค่าประมาณเท่านั้น

## 6. Dashboard ➕

| Method | Path                               | Role                 |
| ------ | ---------------------------------- | -------------------- |
| GET    | `/api/dashboard/summary?from=&to=` | Admin, Owner, Viewer |

```jsonc
{
  "totalSales": 15230.5,
  "orderCount": 87,
  "averageOrderValue": 175.06,
  "lowStockCount": 4,
  "salesByDay": [{ "date": "2026-11-26", "total": 5210.0, "orderCount": 31 }],
  "topItems": [
    {
      "inventoryItemId": "guid",
      "name": "...",
      "quantity": 42,
      "total": 5040.0,
    },
  ],
}
```

หน้า Dashboard เดิมใช้ mock data ทั้งหมด endpoint นี้ทำให้หน้าใหม่ใช้ข้อมูลจริงได้ด้วยการเรียกครั้งเดียว

## 7. Subscriptions และ Health

| Method | Path                               | Role                | สถานะ                                  |
| ------ | ---------------------------------- | ------------------- | -------------------------------------- |
| GET    | `/api/subscriptions/current`       | Admin, Owner        | ✏️ แทน `GET /tenant/{tenantId}`        |
| POST   | `/api/subscriptions/current/renew` | Owner               | ✏️ แทน `POST /tenant/{tenantId}/renew` |
| POST   | `/api/subscriptions`               | ผู้ดูแลระบบ (platform) | ✅ ไม่ได้ใช้จาก frontend นี้                |
| GET    | `/api/subscriptions/expiring`      | ผู้ดูแลระบบ (platform) | ✅ ไม่ได้ใช้จาก frontend นี้                |
| GET    | `/health`                          | ไม่ต้อง login         | ✅                                     |

Frontend เดิมยังไม่มีหน้า Subscription จึงไม่อยู่ในขอบเขตการย้ายรอบแรก

## 8. จองไว้สำหรับ Phase 6

| Path                                                             | ใช้ทำอะไร                                |
| ---------------------------------------------------------------- | --------------------------------------- |
| `/hubs/notifications` (SignalR)                                  | แจ้งเตือน stock ต่ำ และยอดขายแบบ real-time |
| `POST /api/push/subscriptions`, `DELETE /api/push/subscriptions` | เก็บ Web Push subscription               |

Vite dev server ตั้ง proxy ให้ `/api` และ `/hubs` ไว้แล้ว

## 9. เรื่องที่ต้องตัดสินใจ

1. **สูตรภาษี** ตอนนี้สองฝั่งคำนวณไม่ตรงกัน
   - Backend (`OrderService`): ภาษี = ยอดรวม × 7% แล้วค่อยหักส่วนลด
   - Frontend เดิม (`cart.store.ts`): ภาษี = (ยอดรวม − ส่วนลด) × 7%
   - ต้องยืนยันด้วยว่าราคาสินค้าที่บันทึกเป็นราคารวม VAT หรือยังไม่รวม
2. **ที่เก็บ refresh token** เอกสารนี้เสนอ HttpOnly cookie ซึ่งกัน XSS ขโมย token ได้
   ทางเลือกคือส่งใน body แล้วเก็บใน `localStorage` ซึ่งทำง่ายกว่าแต่ปลอดภัยน้อยกว่า
3. **Pagination** v1 คืน array ทั้งหมดแล้วแบ่งหน้าที่ frontend เหมือนของเดิม
   ถ้าร้านมีสินค้าหลักพันรายการขึ้นไปควรเปลี่ยนเป็นแบ่งหน้าที่ server

## 10. งาน backend สำหรับ Phase 4

เรียงตามลำดับที่ frontend ต้องใช้

1. JWT authentication, entity `User`, `AuthController`, policy ตาม role
2. อ่าน tenant จาก claim และเปลี่ยน path ที่มี `tenant/{tenantId}` ทั้งหมด
3. `JsonStringEnumConverter`, CORS เฉพาะ origin, `ProblemDetails`
4. Inventory: filter ใน list, endpoint barcode
5. Orders: `customerId` nullable, `clientOrderId`, filter ใน list
6. Customers: update, delete, `LoyaltyTransaction`, earn, redeem
7. Dashboard summary
8. Receipt PDF (เลื่อนได้)
