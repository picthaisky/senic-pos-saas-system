# 4. การออกแบบทางเทคนิคและข้อกำหนดทางเทคนิค

เอกสารนี้มี 2 ส่วน: **ส่วน A การออกแบบ** อธิบายว่าทำไมระบบจึงเป็นแบบนี้ และ **ส่วน B ข้อกำหนด** ระบุรายละเอียดที่โค้ดต้องเป็นไปตาม
รูปแบบ request และ response ของแต่ละ endpoint อยู่ใน [docs/API_REFERENCE.md](../API_REFERENCE.md) ซึ่งเป็นแหล่งอ้างอิงหลัก เอกสารนี้ไม่ทำซ้ำ

---

## ส่วน A: การออกแบบทางเทคนิค

### A1. การตัดสินใจหลักและเหตุผล

| การตัดสินใจ | เหตุผล | ข้อแลกเปลี่ยน |
| --- | --- | --- |
| รหัสร้านมาจาก token เท่านั้น และกรองที่ DbContext | ความผิดพลาดของนักพัฒนาใน endpoint เดียวไม่ทำให้ข้อมูลรั่วข้ามร้าน | งานเบื้องหลังที่ไม่มีผู้ใช้ต้องกรองร้านเอง |
| Access token ใน memory, refresh token ใน cookie HttpOnly | Script ที่ถูกฝังในหน้าเว็บขโมย refresh token ไม่ได้ | ต้องเสิร์ฟผ่าน HTTPS และ origin เดียวกัน |
| Refresh token ใช้ครั้งเดียว | Token ที่รั่วมีอายุใช้งานสั้น | สองแท็บที่ refresh พร้อมกันพอดีอาจมีแท็บหนึ่งล้มเหลว |
| ทุกบิลมี `clientOrderId` | ส่งซ้ำได้อย่างปลอดภัย เป็นฐานของการขายออฟไลน์ | Client ต้องสร้างและเก็บ id |
| รายการสินค้าออฟไลน์เก็บใน IndexedDB ไม่ใช่ cache ของ service worker | แยกตามร้านได้ และค้นหาคำใหม่ตอนออฟไลน์ได้ | ต้องดูแลการ sync เอง |
| บิลออฟไลน์ที่ server ปฏิเสธไม่ถูกส่งซ้ำอัตโนมัติ | การส่งซ้ำไม่ช่วยถ้าสต็อกไม่พอ ต้องให้คนตัดสินใจ | มีงานค้างให้คนจัดการ |
| การขายจาก POS บันทึกเป็น `Completed` ทันที | ลูกค้าจ่ายที่เคาน์เตอร์แล้ว | ยังไม่รองรับบิลค้างชำระ |
| ลบลูกค้าเป็นการปิดการใช้งาน | บิลเก่ายังอ้างถึงลูกค้าได้ | ข้อมูลยังอยู่ในฐานข้อมูล |
| Push ส่งผ่านคิวเบื้องหลัง | การขายไม่ต้องรอ push service | งานในคิวหายถ้า API หยุด |
| Frontend และ API อยู่ origin เดียวกันผ่าน nginx | ไม่ต้องใช้ CORS, cookie ทำงานตรงไปตรงมา | nginx เป็นจุดผ่านของทุก request |
| Stack เป็น Git-based ใน Portainer | ไฟล์ compose เปลี่ยนและตรวจสอบผ่าน Git เหมือนโค้ด | ต้องให้ Portainer เข้าถึง repo และ registry |

### A2. รูปแบบของโค้ด backend

- Controller บาง: รับ request, อ่านร้านจาก token, เรียก service, แปลงผลเป็น HTTP
- Service คืน `null` เมื่อไม่พบข้อมูล และโยน `ConflictException` หรือ `NotFoundException` เมื่อขัดกับกติกา
- `ApiExceptionHandler` แปลง exception ทั้งสองเป็น 409 และ 404 ในรูปแบบ ProblemDetails
- การเปลี่ยนแปลงหลายตารางในคำสั่งเดียว (เช่น บิล รายการในบิล และสต็อก) บันทึกด้วย `SaveChanges` ครั้งเดียว จึงสำเร็จหรือล้มเหลวพร้อมกัน
- ตัวเลือกการตั้งค่าอ่านแบบ lazy ผ่าน `IOptions` เพื่อให้ค่าจาก environment variable และจาก test มีผลเสมอ

### A3. รูปแบบของโค้ด frontend

- ฟังก์ชันเรียก API และ hook ของ TanStack Query อยู่ใน `api.ts` ของแต่ละฟีเจอร์
- ทุก request ผ่าน `api` ใน `src/lib/api.ts` ซึ่งแนบ token และ refresh ให้อัตโนมัติ
- ฟอร์มใช้ React Hook Form + Zod และสร้าง schema ภายใน component เพื่อให้ข้อความ error เป็นภาษาของผู้ใช้
- ข้อความบนหน้าจอทุกคำมาจาก `th.json` และ `en.json` โดย key ถูกตรวจชนิดกับ `th.json`
- สีใช้ design token (`bg-surface`, `text-fg`, `bg-primary`) ไม่ใช้สีจาก palette ตรง ๆ
- เมนูและสิทธิ์ของหน้าจอประกาศที่เดียวใน `src/app/navigation.ts`

### A4. การจัดการข้อผิดพลาด

| สถานการณ์ | ฝั่ง server | ฝั่ง client |
| --- | --- | --- |
| ข้อมูลไม่ถูกต้อง | 400 พร้อม `errors` ราย field | แสดงข้อความ |
| ไม่ได้ login หรือ token หมดอายุ | 401 | Refresh หนึ่งครั้งแล้วส่งซ้ำ ถ้าไม่ผ่านไปหน้า login |
| ไม่มีสิทธิ์ | 403 | หน้า "ไม่มีสิทธิ์เข้าถึง" (ปกติเมนูจะไม่แสดงตั้งแต่ต้น) |
| ไม่พบ หรือเป็นของร้านอื่น | 404 | แสดงข้อความ |
| ขัดกับข้อมูลปัจจุบัน | 409 พร้อม `detail` | แสดง `detail` |
| ติดต่อ server ไม่ได้ | ไม่มีคำตอบ หรือ 502/503/504 จาก proxy | คง session ไว้, หน้า POS ใช้ข้อมูลในเครื่องและเข้าคิว |

### A5. กลยุทธ์การทดสอบ

| ระดับ | เครื่องมือ | ครอบคลุม |
| --- | --- | --- |
| Unit ของ backend | xUnit, Moq | Service และ repository |
| Integration ของ backend | `WebApplicationFactory` + ฐานข้อมูลใน memory | ทั้งเส้นทาง HTTP: login, สิทธิ์, การแยกร้าน, กติกาทางธุรกิจ, SignalR, push |
| Component และ flow ของ frontend | Vitest, React Testing Library, API จำลอง | หน้าจอ, routing, ออฟไลน์, การ refresh token |
| Script deploy | node:test กับ Portainer จำลอง | รูปแบบ request และการรวมตัวแปร |
| Smoke test บน stack จริง | Script ชั่วคราว | **ยังไม่อยู่ใน repo** ควรเพิ่มเป็น end-to-end test |

ช่องว่าง: ยังไม่มี test ที่รันกับ PostgreSQL จริงใน CI, ไม่มี end-to-end test ในเบราว์เซอร์, ไม่มี load test

---

## ส่วน B: ข้อกำหนดทางเทคนิค

### B1. การยืนยันตัวตนและสิทธิ์

| รายการ | ค่า |
| --- | --- |
| Access token | JWT ลงนาม HMAC-SHA256, อายุ 15 นาที (`Jwt:AccessTokenMinutes`), claim: `sub`, `tenantId`, `role`, `email`, `name` |
| Refresh token | อายุ 7 วัน (`Jwt:RefreshTokenDays`), cookie ชื่อ `senic_refresh`, `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` |
| ความคลาดเคลื่อนของนาฬิกาที่ยอมรับ | 30 วินาที |
| บทบาท | `Admin`, `Owner`, `Cashier`, `Viewer` |
| การ login | ต้องส่ง `tenantId`, `email`, `password`; อีเมลเทียบแบบตัวพิมพ์เล็ก; คำตอบเมื่อผิดเหมือนกันทุกกรณี |
| ผู้ใช้คนแรก | สร้างจาก `Bootstrap:*` เมื่อร้านยังไม่มีผู้ใช้, รหัสผ่านอย่างน้อย 12 ตัวอักษร |

สิทธิ์ต่อกลุ่ม endpoint:

| กลุ่ม | อ่าน | เขียน |
| --- | --- | --- |
| Inventory | ทุกบทบาท (low-stock: Admin, Owner) | Admin, Owner |
| Customers | ทุกบทบาท | สร้างและแต้ม: Admin, Owner, Cashier; แก้และลบ: Admin, Owner |
| Orders | รายการ: Admin, Owner, Viewer; รายบิล: ทุกบทบาท | ขาย: Admin, Owner, Cashier; ยกเลิก: Admin, Owner |
| Dashboard | Admin, Owner, Viewer | – |
| Subscriptions | ของร้านตัวเอง: Admin, Owner | ต่ออายุ: Owner; ข้ามร้าน: Admin |
| Push | ทุกบทบาท | ทุกบทบาท |

สิทธิ์เข้าหน้าจอใน frontend: Dashboard (Admin, Owner, Viewer), POS (Admin, Owner, Cashier), Inventory และ Customers (Admin, Owner)

### B2. กติกาทางธุรกิจ

**การขาย**

- ยอดของแต่ละรายการ = ราคา × จำนวน − ส่วนลดของรายการ
- ยอดรวมสินค้า (`totalAmount`) = ผลรวมของทุกรายการ
- ภาษี (`taxAmount`) = ยอดรวมสินค้า × 7% ปัดเป็น 2 ตำแหน่งแบบปัดครึ่งขึ้น
- ยอดสุทธิ (`netAmount`) = ยอดรวมสินค้า + ภาษี − ส่วนลดท้ายบิล
- สูตรนี้ยังรอการยืนยันจากเจ้าของโครงการ
- ถ้าสินค้ารายการใดมีไม่พอ ทั้งบิลถูกปฏิเสธด้วย 409 และไม่ตัดสต็อกรายการใด
- เลขบิลมีรูปแบบ `ORD-yyyyMMdd-XXXXXXXX`
- บิลที่ส่ง `clientOrderId` ซ้ำได้บิลเดิมกลับมา
- การยกเลิกบิลคืนสต็อก และการยกเลิกซ้ำไม่คืนสต็อกซ้ำ

**สินค้า**

- SKU และบาร์โค้ดไม่ซ้ำกันภายในร้าน
- สินค้า "ใกล้หมด" เมื่อจำนวน ≤ จุดสั่งซื้อ (`minimumStock`)
- การค้นหาเทียบกับชื่อ SKU และบาร์โค้ด โดยไม่สนตัวพิมพ์

**ลูกค้าและแต้ม**

- อีเมลไม่บังคับ แต่ถ้ามีต้องไม่ซ้ำภายในร้าน
- แต้มที่เพิ่มหรือแลกต้องเป็นจำนวนเต็มบวก และแลกเกินยอดคงเหลือไม่ได้ (409)
- ทุกการเปลี่ยนแต้มถูกบันทึกเป็น `LoyaltyTransaction`

**รายงาน**

- วันในรายงานนับตามเขตเวลาของร้าน (`Business:TimeZone`, ค่าเริ่มต้น `Asia/Bangkok`)
- Dashboard นับเฉพาะบิลสถานะ `Completed`, ช่วงเริ่มต้น 7 วันล่าสุด, ช่วงยาวสุด 366 วัน

### B3. ข้อกำหนดของข้อมูล

| ตาราง | คีย์และ index สำคัญ | หมายเหตุ |
| --- | --- | --- |
| Users | unique (`TenantId`, `Email`) | `PasswordHash` ยาวสูงสุด 500 |
| RefreshTokens | unique `TokenHash` | เก็บ SHA-256 ของ token, ลบตามผู้ใช้ |
| InventoryItems | unique (`TenantId`, `Sku`), unique (`TenantId`, `Barcode`) | เงินใช้ `decimal(18,2)` |
| Customers | unique (`TenantId`, `Email`) | `Email` เป็น null ได้ |
| Orders | unique `OrderNumber`, unique (`TenantId`, `ClientOrderId`), index (`TenantId`, `CreatedAt`) | `CustomerId` เป็น null ได้ |
| OrderItems | FK ไป Orders (ลบตาม) และ InventoryItems (ห้ามลบ) | |
| LoyaltyTransactions | index (`TenantId`, `CustomerId`) | |
| PushSubscriptions | unique `Endpoint` | หนึ่งแถวต่อเบราว์เซอร์ |
| Subscriptions | unique `TenantId` | |

- เวลาทุกค่าเก็บเป็น UTC
- Migration อยู่ที่ `backend/SenicPosSaaS.Infrastructure/Data/Migrations` และสร้างสำหรับ PostgreSQL เท่านั้น
- Enum ส่งผ่าน API เป็นชื่อ แต่เก็บในฐานข้อมูลเป็นตัวเลข

### B4. Real-time และ Push

| รายการ | ข้อกำหนด |
| --- | --- |
| Hub | `/hubs/notifications` ต้องมี access token |
| `OrderCreated` | ส่งให้ Admin, Owner, Viewer ของร้าน หลังบันทึกบิลสำเร็จ |
| `LowStock` | ส่งให้ Admin, Owner ของร้าน ครั้งเดียวเมื่อจำนวนข้ามลงมาถึงจุดสั่งซื้อ |
| Push | ส่งเมื่อเกิด `LowStock` ให้เบราว์เซอร์ที่ลงทะเบียนของ Admin และ Owner ในภาษาที่เลือกตอนลงทะเบียน |
| Endpoint ของ push | ต้องเป็น `https` และอยู่ใน `Push:AllowedHosts` |
| Subscription ที่ push service แจ้งว่าไม่มีแล้ว | ลบอัตโนมัติ |

### B5. การทำงานออฟไลน์

| รายการ | ข้อกำหนด |
| --- | --- |
| ขอบเขต | เฉพาะหน้า POS |
| ที่เก็บ | IndexedDB ชื่อ `senic-pos`: `catalog` (ต่อร้าน), `orderQueue` (ต่อบิล) |
| การ sync รายการสินค้า | เมื่อเปิดหน้า POS และเมื่อกลับมาออนไลน์ |
| การส่งคิว | ตามลำดับเวลา, หยุดเมื่อติดต่อ server ไม่ได้, บิลที่ถูกปฏิเสธเปลี่ยนเป็น "ส่งไม่สำเร็จ" และไม่ส่งซ้ำอัตโนมัติ |
| การแยกร้าน | บิลในคิวถูกส่งเฉพาะเมื่อผู้ใช้ของร้านเดียวกัน login อยู่ |
| Session | การติดต่อ server ไม่ได้ไม่ทำให้หลุด login; ตอนเปิดแอปใช้ข้อมูลผู้ใช้คนล่าสุดโดยไม่มี token |

### B6. การตั้งค่าของระบบ

| ค่า | ความหมาย | จำเป็น |
| --- | --- | --- |
| `ConnectionStrings:PostgreSQL` | การเชื่อมต่อฐานข้อมูล | ใช่ |
| `Jwt:Key` | กุญแจลงนาม อย่างน้อย 32 ตัวอักษร | ใช่ นอก Development |
| `Database:MigrateOnStartup` | Migrate ตอน start สำหรับ instance เดียว | ไม่ |
| `Bootstrap:TenantId`, `OwnerEmail`, `OwnerPassword` | สร้างผู้ใช้คนแรก | ครั้งแรกของร้านใหม่ |
| `Cors:AllowedOrigins` | Origin ของ frontend เมื่ออยู่คนละ origin | ไม่ |
| `Business:TimeZone` | เขตเวลาของรายงาน | ไม่ |
| `Push:PublicKey`, `PrivateKey`, `Subject` | VAPID สำหรับ push | ไม่ ถ้าไม่ตั้ง push ปิด |
| `APP_VERSION` | เวอร์ชันที่ `/health` รายงาน กำหนดตอน build image | ไม่ |

ตัวแปรของ stack production อยู่ใน [deploy/stack.env.example](../../deploy/stack.env.example)

### B7. ข้อกำหนดที่ไม่ใช่ฟังก์ชัน

ตารางนี้แยกสิ่งที่ระบบทำได้แล้วออกจากเป้าหมายที่เสนอ **ยังไม่มีการวัดประสิทธิภาพ จึงไม่มีตัวเลขปัจจุบันให้อ้าง**

| ด้าน | สถานะปัจจุบัน | เป้าหมายที่เสนอ (ยังไม่ได้ตกลง) |
| --- | --- | --- |
| ความพร้อมใช้ | Instance เดียว มี downtime สั้น ๆ ตอน deploy | กำหนดเป้าเวลาพร้อมใช้ต่อเดือนหลังมีการเฝ้าระวัง |
| การกู้คืน | ไม่มีการสำรองอัตโนมัติ | สำรองทุกวัน และกำหนดเวลากู้คืนสูงสุด |
| ประสิทธิภาพ | ยังไม่เคยวัด | กำหนดจากผล load test ใน Milestone 3 |
| เบราว์เซอร์ | ต้องรองรับ service worker และ IndexedDB; ปุ่มติดตั้งมีเฉพาะเบราว์เซอร์ตระกูล Chromium | ทดสอบจริงบน Chrome, Edge, Safari, Firefox รุ่นปัจจุบัน |
| การเข้าถึง | Component มี label และบทบาทสำหรับโปรแกรมอ่านหน้าจอ | ตรวจตาม WCAG 2.1 AA |
| ภาษา | ไทย, อังกฤษ | – |
| ความปลอดภัย | ตามหัวข้อ 8 ของ [พิมพ์เขียว](03-system-blueprint.md) | เพิ่มการจำกัด login, audit trail |

### B8. สภาพแวดล้อม

| สภาพแวดล้อม | วิธีรัน | ลักษณะ |
| --- | --- | --- |
| พัฒนา frontend อย่างเดียว | `npm run dev` พร้อมโหมดจำลอง | ไม่ต้องมี backend |
| พัฒนาเต็มระบบ | `dotnet run` + `npm run dev` หรือ `backend/docker-compose.yml` | Migrate และ seed ข้อมูลตัวอย่างอัตโนมัติ |
| Production | `deploy/docker-compose.yml` ผ่าน Portainer | Image จาก GHCR, ความลับจากตัวแปรของ stack |
| Kubernetes | `backend/k8s/` | ยังใช้ไม่ได้กับหลาย replica ตามข้อจำกัดในพิมพ์เขียว |
