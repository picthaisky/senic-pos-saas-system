# API Contract v1 – Senic POS

เอกสารนี้เป็นข้อตกลงระหว่าง frontend (React, `frontend/`) กับ backend (.NET, `backend/`)
Backend ทำตาม contract นี้ครบแล้ว และมี integration test กำกับใน `backend/SenicPosSaaS.Tests/Api/`

- ✅ ใช้ได้แล้ว
- ⏳ ยังไม่ได้ทำ

## 1. ข้อตกลงร่วม

| เรื่อง           | ข้อตกลง                                                                                                    | สถานะ backend |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| Base path      | ทุก endpoint อยู่ใต้ `/api`                                                                                   | ✅            |
| รูปแบบข้อมูล      | JSON, ชื่อ field เป็น camelCase                                                                              | ✅            |
| Enum           | ส่งเป็น string เช่น `"Cash"`, `"Completed"`                                                                  | ✅            |
| วันที่            | ISO 8601 UTC เช่น `2026-11-27T08:30:00Z`                                                                   | ✅            |
| Tenant         | อ่านจาก claim `tenantId` ใน JWT เท่านั้น ไม่รับจาก URL หรือ body                                                 | ✅            |
| Authentication | `Authorization: Bearer <accessToken>` ทุก endpoint ยกเว้น `/api/auth/login`, `/api/auth/refresh`, `/health` | ✅            |
| Error          | RFC 7807 `ProblemDetails` (`title`, `status`, `detail`, `errors`)                                         | ✅            |
| CORS           | อนุญาตเฉพาะ origin ของ frontend และ `AllowCredentials`                                                     | ✅            |

Status code ที่ frontend จัดการ: `400` (validation, แสดงใต้ field จาก `errors`), `401` (ลอง refresh 1 ครั้ง
ถ้าไม่ผ่านให้กลับหน้า login), `403` (ไม่มีสิทธิ์), `404`, `409` (เช่น stock ไม่พอ, SKU ซ้ำ),
`429` (login ถี่หรือผิดหลายครั้งเกินไป มี header `Retry-After` เป็นวินาที)

## 2. Authentication

Role ที่ใช้: `Admin`, `Owner`, `Cashier`, `Viewer`

| Method | Path                        | คำอธิบาย                |
| ------ | --------------------------- | ---------------------- |
| POST   | `/api/auth/login`           | เข้าสู่ระบบ               |
| POST   | `/api/auth/refresh`         | ขอ access token ใหม่    |
| POST   | `/api/auth/logout`          | ยกเลิก refresh token    |
| GET    | `/api/auth/me`              | ข้อมูลผู้ใช้ปัจจุบัน           |
| POST   | `/api/auth/change-password` | ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง |

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
- Token ที่หมดอายุหรือถูกยกเลิกเกิน 7 วันถูกลบโดยงานเบื้องหลังวันละครั้ง

### การป้องกันการเดารหัสผ่าน ✅

- **ล็อกบัญชีชั่วคราว:** ใส่รหัสผ่านผิด 5 ครั้งติดกัน บัญชีนั้น (ร้าน + อีเมล) ถูกล็อก 15 นาที ระหว่างนั้น
  `/login` ตอบ `429` พร้อม `Retry-After` แม้รหัสผ่านจะถูก การ login สำเร็จล้างตัวนับ
- **จำกัดความถี่ต่อ IP:** `/login`, `/refresh` และ `/change-password` รับได้ 60 ครั้งต่อนาทีต่อ IP เกินแล้วตอบ `429`
- ค่าทั้งหมดตั้งได้ที่ section `LoginProtection` (`MaxFailedAttempts`, `LockoutMinutes`, `RequestsPerMinutePerIp`)
- ตัวนับอยู่ใน memory ของ API: หายเมื่อ restart และไม่แชร์ข้าม instance (ปัจจุบันรัน instance เดียว)
- หลัง reverse proxy API อ่าน IP จริงจาก `X-Forwarded-For` เฉพาะที่มาจากเครือข่ายที่ไว้ใจ
  (`ForwardedHeaders:TrustedNetworks`, `ForwardedHeaders:ForwardLimit`) ถ้าตั้งจำนวน proxy ผิด ทุกคนจะถูกนับเป็น IP เดียวกัน

### เปลี่ยนรหัสผ่านของตัวเอง ✅

```jsonc
// POST /api/auth/change-password  (ทุก role)  → 204
{ "currentPassword": "...", "newPassword": "อย่างน้อย 8 ตัวอักษร ไม่เกิน 128" }
```

- รหัสผ่านปัจจุบันผิดได้ `400` พร้อม `errors.CurrentPassword` (ไม่ใช่ `401` เพราะ session ยังใช้ได้)
- สำเร็จแล้วอุปกรณ์อื่นของบัญชีนี้ถูกออกจากระบบ อุปกรณ์ที่สั่งเปลี่ยนยังใช้ต่อได้

### จัดการผู้ใช้ของร้าน ✅

เฉพาะ `Admin` และ `Owner` และเห็นเฉพาะผู้ใช้ของร้านตัวเอง

| Method | Path                             | คำอธิบาย                                             |
| ------ | -------------------------------- | --------------------------------------------------- |
| GET    | `/api/users`                     | รายชื่อผู้ใช้ (ที่ใช้งานอยู่ขึ้นก่อน เรียงตามชื่อ)                  |
| POST   | `/api/users`                     | เพิ่มผู้ใช้ → `201`, อีเมลซ้ำในร้านเดียวกัน → `409`           |
| PUT    | `/api/users/{id}`                | แก้ชื่อ บทบาท หรือเปิด/ปิดการใช้งาน ส่งเฉพาะ field ที่จะเปลี่ยน |
| POST   | `/api/users/{id}/reset-password` | ตั้งรหัสผ่านใหม่ให้ผู้ใช้ที่ลืม → `204`                         |

```jsonc
// POST /api/users
{ "email": "cashier@shop.com", "name": "สมหญิง", "role": "Cashier", "password": "อย่างน้อย 8 ตัวอักษร" }

// PUT /api/users/{id}  (ทุก field ไม่บังคับ)
{ "name": "สมหญิง รักงาน", "role": "Viewer", "isActive": false }

// ผู้ใช้ในคำตอบ
{ "id": "guid", "email": "...", "name": "...", "role": "Cashier", "isActive": true, "createdAt": "..." }
```

- อีเมลถูกเก็บเป็นตัวพิมพ์เล็ก และแก้ไม่ได้หลังสร้าง
- ปิดการใช้งาน หรือ reset รหัสผ่าน จะยกเลิก refresh token ทั้งหมดของผู้ใช้นั้นทันที
  access token ที่ออกไปแล้วยังใช้ได้จนหมดอายุ (ไม่เกิน 15 นาที)
- `409` เมื่อผู้จัดการพยายามเปลี่ยนบทบาทหรือปิดบัญชีของตัวเอง และเมื่อการแก้จะทำให้ร้านไม่เหลือ `Owner` ที่ใช้งานอยู่
- ยังไม่มีการลบผู้ใช้ ใช้การปิดการใช้งานแทน เพื่อให้บิลเก่ายังอ้างถึงผู้ขายได้

## 3. Inventory

| Method | Path                                                   | Role         | สถานะ |
| ------ | ------------------------------------------------------ | ------------ | ----- |
| GET    | `/api/inventory?search=&category=&isActive=&lowStock=` | ทุก role      | ✅    |
| GET    | `/api/inventory/{id}`                                  | ทุก role      | ✅    |
| GET    | `/api/inventory/barcode/{barcode}`                     | ทุก role      | ✅    |
| GET    | `/api/inventory/low-stock`                             | Admin, Owner | ✅    |
| POST   | `/api/inventory`                                       | Admin, Owner | ✅    |
| PUT    | `/api/inventory/{id}`                                  | Admin, Owner | ✅    |
| DELETE | `/api/inventory/{id}`                                  | Admin, Owner | ✅    |

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

| Method | Path                                 | Role                  | สถานะ |
| ------ | ------------------------------------ | --------------------- | ----- |
| GET    | `/api/customers?search=`             | ทุก role               | ✅    |
| GET    | `/api/customers/{id}`                | ทุก role               | ✅    |
| POST   | `/api/customers`                     | Admin, Owner, Cashier | ✅    |
| PUT    | `/api/customers/{id}`                | Admin, Owner          | ✅    |
| DELETE | `/api/customers/{id}`                | Admin, Owner          | ✅    |
| GET    | `/api/customers/{id}/loyalty`        | ทุก role               | ✅    |
| POST   | `/api/customers/{id}/loyalty/earn`   | Admin, Owner, Cashier | ✅    |
| POST   | `/api/customers/{id}/loyalty/redeem` | Admin, Owner, Cashier | ✅    |

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

| Method | Path                            | Role                  | สถานะ                            |
| ------ | ------------------------------- | --------------------- | -------------------------------- |
| GET    | `/api/orders?from=&to=&status=` | Admin, Owner, Viewer  | ✅                               |
| GET    | `/api/orders/{id}`              | ทุก role               | ✅                               |
| POST   | `/api/orders`                   | Admin, Owner, Cashier | ✅                               |
| POST   | `/api/orders/{id}/cancel`       | Admin, Owner          | ✅                               |
| GET    | `/api/orders/{id}/receipt`      | ทุก role               | ⏳ ยังไม่ได้ทำ คืน `application/pdf` |

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

พฤติกรรมของ `POST /api/orders`

- `customerId` เป็น `null` ได้ สำหรับลูกค้าทั่วไป
- ส่ง `clientOrderId` เดิมซ้ำจะได้ order เดิมกลับมา ไม่สร้างใหม่และไม่ตัดสต็อกซ้ำ
- สต็อกไม่พอคืน `409` และไม่ตัดสต็อกของรายการใดในบิลนั้น

Frontend เปลี่ยนมาใช้ชื่อ field ของ backend: `totalAmount`, `netAmount`, `discountAmount`, `itemName`,
`unitPrice` ยอดเงินทุกตัวให้ยึดค่าที่ backend คำนวณ ตะกร้าใน frontend แสดงเป็นค่าประมาณเท่านั้น

## 6. Dashboard

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

ค่าเริ่มต้นเมื่อไม่ส่ง `from` และ `to` คือ 7 วันล่าสุด ช่วงยาวสุดที่ขอได้คือ 366 วัน

## 7. Subscriptions และ Health

| Method | Path                               | Role                | สถานะ                                             |
| ------ | ---------------------------------- | ------------------- | ------------------------------------------------- |
| GET    | `/api/subscriptions/current`       | Admin, Owner        | ✅                                                |
| POST   | `/api/subscriptions/current/renew` | Owner               | ✅                                                |
| POST   | `/api/subscriptions`               | ผู้ดูแลระบบ (platform) | ✅ ไม่ได้ใช้จาก frontend นี้                           |
| GET    | `/api/subscriptions/expiring`      | ผู้ดูแลระบบ (platform) | ✅ ไม่ได้ใช้จาก frontend นี้                           |
| GET    | `/health`                          | ไม่ต้อง login         | ✅ ตัวแอปทำงาน (liveness) และบอก `version`         |
| GET    | `/health/ready`                    | ไม่ต้อง login         | ✅ ต่อฐานข้อมูลได้ ถ้าไม่ได้ตอบ `503` ใช้ตัวนี้กับระบบเฝ้าระวัง |

Frontend เดิมยังไม่มีหน้า Subscription จึงไม่อยู่ในขอบเขตการย้ายรอบแรก

## 8. Real-time และ Push

### SignalR hub ✅

เชื่อมต่อที่ `/hubs/notifications` ต้องส่ง access token (SignalR client ส่งให้ผ่าน `accessTokenFactory`)
Hub ส่งข้อมูลทางเดียว client ไม่ต้องเรียก method ใด ผู้ใช้ได้รับเฉพาะ event ของ tenant ตัวเอง

| Event          | ส่งเมื่อ                                   | ผู้รับ                  |
| -------------- | --------------------------------------- | -------------------- |
| `OrderCreated` | บันทึกการขายสำเร็จ                         | Admin, Owner, Viewer |
| `LowStock`     | การขายทำให้สินค้าลดลงถึงจุดสั่งซื้อ (แจ้งครั้งเดียว) | Admin, Owner         |

```jsonc
// OrderCreated
{ "orderId": "guid", "orderNumber": "ORD-...", "netAmount": 256.8 }

// LowStock
{ "inventoryItemId": "guid", "name": "...", "quantity": 9, "minimumStock": 10 }
```

- `LowStock` ส่งเฉพาะตอนที่จำนวนข้ามจากมากกว่าจุดสั่งซื้อลงมาถึงหรือต่ำกว่า การขายครั้งถัดไปของสินค้าที่ต่ำอยู่แล้วไม่แจ้งซ้ำ
- การแก้จำนวนผ่าน `PUT /api/inventory/{id}` และการยกเลิกบิลยังไม่ส่ง event
- ถ้าส่ง event ไม่สำเร็จ การขายยังสำเร็จตามปกติ
- เมื่อรัน API หลาย instance ต้องเพิ่ม backplane (เช่น Redis) ไม่เช่นนั้น event จะไปถึงเฉพาะผู้ใช้ที่ต่ออยู่กับ instance เดียวกัน

Vite dev server และ nginx ของ frontend ตั้ง proxy ให้ `/hubs` ไว้แล้ว

### Web Push ✅

แจ้งเตือนที่ไปถึงเครื่องแม้ปิดแอปอยู่ ตอนนี้ส่งเรื่องเดียวคือสินค้าถึงจุดสั่งซื้อ (เหตุการณ์เดียวกับ `LowStock`)
ให้ผู้ใช้ role Admin และ Owner ของ tenant นั้น ทุก role ลงทะเบียนเครื่องได้ แต่ role อื่นยังไม่มีเรื่องที่ส่งให้

| Method | Path                      | คำอธิบาย                                                           |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/push/public-key`    | VAPID public key สำหรับ subscribe คืน `404` ถ้า server ไม่ได้ตั้งค่า push |
| POST   | `/api/push/subscriptions` | ลงทะเบียนเบราว์เซอร์นี้ให้ผู้ใช้ปัจจุบัน คืน `204`                             |
| DELETE | `/api/push/subscriptions` | ยกเลิก (ส่ง `endpoint` ใน body) คืน `204` เสมอ                       |

```jsonc
// POST /api/push/subscriptions  (ค่าจาก PushSubscription.toJSON() ของเบราว์เซอร์ + ภาษา)
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": { "p256dh": "...", "auth": "..." },
  "language": "th"               // th | en ใช้เขียนข้อความแจ้งเตือน
}

// ข้อมูลที่ service worker ได้รับ
{ "title": "สินค้าใกล้หมด", "body": "... เหลือ 4 (จุดสั่งซื้อ 5)", "tag": "low-stock-<itemId>", "url": "/inventory" }
```

- `endpoint` ต้องเป็น `https` และอยู่ใน host ของ push service ที่อนุญาต (`Push:AllowedHosts`) ไม่เช่นนั้นคืน `400`
  เพราะ server จะส่ง request ไปยัง URL นี้ จึงต้องกันไม่ให้ชี้ไปที่อื่น
- เบราว์เซอร์หนึ่งตัวมี subscription เดียว ถ้าผู้ใช้อีกคนลงทะเบียนเครื่องเดิม เครื่องนั้นจะเป็นของคนล่าสุด
- Frontend ยกเลิก subscription ให้เองเมื่อออกจากระบบ
- Subscription ที่ push service แจ้งว่าไม่มีแล้ว (`404`/`410`) จะถูกลบอัตโนมัติ
- การส่งทำในคิวเบื้องหลังของ API การขายจึงไม่ต้องรอ ถ้า API หยุดทำงาน รายการที่ค้างในคิวจะหายไป

## 9. รายละเอียดที่ควรรู้

- **Login สำหรับพัฒนา**: เมื่อรันใน Development ระบบ seed ผู้ใช้ `admin@demo.test`, `owner@demo.test`,
  `cashier@demo.test` และ `viewer@demo.test` ใน tenant `11111111-1111-1111-1111-111111111111`
  รหัสผ่านอยู่ที่ `Seed:DemoPassword` ใน `backend/SenicPosSaaS.API/appsettings.Development.json`
- **Refresh token** อยู่ใน cookie `senic_refresh` (`HttpOnly; Secure; SameSite=Strict; Path=/api/auth`)
  ใช้ได้ครั้งเดียว ทุกครั้งที่ refresh จะออก token ใหม่และยกเลิกตัวเดิม
- **วันที่ใน `from` และ `to`** เป็นวันตามเวลาของร้าน กำหนดด้วย `Business:TimeZone` (ค่าเริ่มต้น `Asia/Bangkok`)
  ทั้งสองวันนับรวมในช่วง และ `salesByDay` ของ Dashboard จัดกลุ่มตามเวลาเดียวกัน
- **การขายถือว่าชำระแล้ว**: `POST /api/orders` สร้าง order สถานะ `Completed` ทันที Dashboard นับเฉพาะสถานะนี้
- **ลบลูกค้า** เป็นการปิดการใช้งาน (soft delete) order เดิมของลูกค้ายังอยู่ครบ
- **`PUT`** ทั้งของ inventory และ customers ข้าม field ที่ส่งเป็น `null` จึงยังล้างค่า field ให้ว่างไม่ได้
- **การทำงานพร้อมกัน**: สต็อกและแต้มสะสมมีการตรวจเวอร์ชันของแถว ถ้าสองคำขอแก้พร้อมกัน ระบบอ่านข้อมูลใหม่แล้วลองอีกครั้ง จึงขายเกินสต็อกหรือแลกแต้มเกินยอดไม่ได้ การแก้ไขสินค้าที่ชนกับการขายคืน `409` ให้โหลดข้อมูลใหม่
- **ฐานข้อมูล**: รองรับ PostgreSQL เท่านั้น
- **`Jwt:Key`** ต้องตั้งเองนอก Development (เช่น environment variable `Jwt__Key`) ไม่เช่นนั้น API จะไม่ start
- **`Cors:AllowedOrigins`** ต้องใส่ origin ของ frontend เมื่อ frontend กับ API อยู่คนละ origin
- **`Push:PublicKey`, `Push:PrivateKey`, `Push:Subject`** ต้องตั้งเองนอก Development จึงจะใช้ push ได้ ถ้าไม่ตั้ง ระบบส่วนอื่นทำงานปกติและปุ่มแจ้งเตือนจะไม่แสดง

## 10. เรื่องที่ยังเปิดอยู่

1. **สูตรภาษี** ยังเป็นของเดิม: ภาษี = ยอดรวมสินค้า × 7% (ปัดเป็น 2 ตำแหน่ง) แล้วค่อยหักส่วนลดท้ายบิล
   ต้องยืนยันว่าควรคิดภาษีหลังหักส่วนลดหรือไม่ และราคาสินค้ารวม VAT แล้วหรือยัง
2. **Endpoint ข้าม tenant ของ Subscriptions** (`POST /api/subscriptions`, `GET /api/subscriptions/expiring`)
   ตอนนี้จำกัดที่ role `Admin` ของ tenant ใดก็ได้ ซึ่งยังเห็นข้อมูล subscription ของ tenant อื่น
   ต้องแยกเป็นสิทธิ์ของผู้ดูแลแพลตฟอร์มก่อนใช้งานจริง
3. **การจัดการผู้ใช้** ยังไม่มี endpoint สำหรับสร้างหรือแก้ไขผู้ใช้และเปลี่ยนรหัสผ่าน
4. **Pagination** ทุก list คืน array ทั้งหมด ควรแบ่งหน้าที่ server เมื่อข้อมูลมีหลักพันรายการ
5. **Receipt PDF** (`GET /api/orders/{id}/receipt`) ยังไม่ได้ทำ
