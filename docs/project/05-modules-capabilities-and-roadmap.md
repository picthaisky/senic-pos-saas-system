# 5. แนวทางพัฒนาโมดูล ความสามารถของระบบ และ Future Enhancements

## 1. แผนที่โมดูล

| โมดูล | Backend | Frontend | สถานะ |
| --- | --- | --- | --- |
| Authentication | `AuthController`, `AuthService` | `features/auth`, `stores/auth`, `lib/api` | ใช้ได้ |
| POS | `OrdersController`, `OrderService` | `features/pos` | ใช้ได้ |
| Offline | – (อาศัย `clientOrderId`) | `features/pos/offline` | ใช้ได้ |
| Inventory | `InventoryController`, `InventoryItemService` | `features/inventory` | ใช้ได้ |
| Customers และ Loyalty | `CustomersController`, `CustomerService` | `features/customers` | ใช้ได้ |
| Dashboard | `DashboardController`, `DashboardService` | `features/dashboard` | ใช้ได้ |
| Real-time | `NotificationsHub`, `RealtimeNotifier` | `app/realtime.ts` | ใช้ได้ |
| Push | `PushController`, `PushSubscriptionService`, `WebPushSender` | `lib/push.ts`, `public/push-sw.js` | ใช้ได้ ยังไม่เคยทดสอบบนอุปกรณ์จริง |
| Subscriptions | `SubscriptionsController`, `SubscriptionService` | ยังไม่มีหน้าจอ | บางส่วน |
| User management | เฉพาะ bootstrap ผู้ใช้คนแรก | ยังไม่มี | ยังไม่มี |
| Reports, Receipts, Payments | ยังไม่มี | ยังไม่มี | ยังไม่มี |

## 2. ความสามารถของระบบตามผู้ใช้

### แคชเชียร์

- Login แล้วเข้าหน้าขายทันที
- ค้นหาสินค้าด้วยชื่อหรือ SKU และสแกนบาร์โค้ด
- เพิ่ม ลด และลบสินค้าในตะกร้า โดยจำนวนไม่เกินสต็อก
- เลือกลูกค้าหรือขายให้ลูกค้าทั่วไป และเลือกวิธีชำระเงิน 5 แบบ
- ขายต่อได้เมื่อเน็ตหลุด และเห็นจำนวนบิลที่รอส่ง
- เพิ่มลูกค้าใหม่ และเพิ่มหรือแลกแต้ม (ผ่าน API; หน้าจอลูกค้าเปิดให้เฉพาะ Admin และ Owner)

### เจ้าของร้านและผู้ดูแล

- ทุกอย่างที่แคชเชียร์ทำได้
- จัดการสินค้า: เพิ่ม แก้ไข ลบ กรองตามหมวดหมู่และสินค้าใกล้หมด เรียงลำดับ ส่งออก CSV
- จัดการลูกค้า: รายชื่อ แต้ม ประวัติแต้ม ลบ ส่งออก CSV
- ดู dashboard: ยอดขาย จำนวนบิล ยอดเฉลี่ยต่อบิล สินค้าใกล้หมด กราฟยอดขายรายวัน สินค้าขายดี
- ได้รับแจ้งเตือนสินค้าใกล้หมดทั้งในแอปและ push
- ยกเลิกบิล (ผ่าน API; ยังไม่มีหน้าจอ)

### ผู้ดูรายงาน

- ดู dashboard และรายการบิล (รายการบิลผ่าน API; ยังไม่มีหน้าจอ)

### ทุกบทบาท

- เปลี่ยนภาษาไทย/อังกฤษ และโหมดสว่าง/มืด
- ติดตั้งเป็นแอปบนเบราว์เซอร์ที่รองรับ
- ได้รับแจ้งเมื่อมีเวอร์ชันใหม่ โดยแอปไม่ reload เองระหว่างใช้งาน

### ความสามารถที่มีใน API แต่ยังไม่มีหน้าจอ

รายการบิลและการกรอง, การยกเลิกบิล, การแก้ไขข้อมูลลูกค้า, การดูและต่ออายุ subscription, รายการสินค้าใกล้หมดแยก endpoint

## 3. แนวทางพัฒนาโมดูลใหม่

ลำดับนี้ใช้กับทุกโมดูล เพื่อให้สองฝั่งตรงกันตั้งแต่ต้น

### ขั้นที่ 1: สัญญา API ก่อน

เพิ่ม endpoint, บทบาท, รูปแบบ request/response และ status code ลงใน [docs/API_REFERENCE.md](../API_REFERENCE.md)
ถ้ามีกติกาทางธุรกิจใหม่ ให้เพิ่มในหัวข้อ B2 ของ [ข้อกำหนดทางเทคนิค](04-technical-design-and-specifications.md)

### ขั้นที่ 2: Backend

1. **Domain:** entity สืบทอดจาก `TenantEntity` ถ้าเป็นข้อมูลของร้าน
2. **Infrastructure:** เพิ่ม `DbSet`, การตั้งค่า entity และ **query filter ของร้าน** ใน `ApplicationDbContext` แล้วสร้าง migration
3. **Application:** DTO พร้อม validation, interface และ service; ใช้ `ConflictException` และ `NotFoundException` สำหรับกรณีขัดกติกา
4. **API:** controller สืบทอดจาก `TenantControllerBase`, กำหนด `[Authorize(Roles = ...)]`, ลงทะเบียน service ใน `Program.cs`
5. **Test:** integration test ใน `SenicPosSaaS.Tests/Api` ต้องมีอย่างน้อย: กรณีปกติ, ร้านอื่นเข้าถึงไม่ได้, บทบาทที่ไม่มีสิทธิ์ได้ 403

ข้อห้าม: รับ `tenantId` จาก URL หรือ body, เรียก `IgnoreQueryFilters` โดยไม่กรองร้านเอง

### ขั้นที่ 3: Frontend

1. สร้าง `src/features/<ชื่อ>/` พร้อม `types.ts`, `api.ts`, `pages/`, `components/`
2. เพิ่มหน้าใน `src/app/navigation.ts` พร้อมบทบาท และ loader ใน `src/app/router.tsx`
3. เพิ่ม key ใน `th.json` และ `en.json`
4. เพิ่ม route ใน API จำลอง (`src/mocks/mock-data.ts`) ให้ตรงสัญญา
5. Test ระดับหน้าจอใน `features.test.tsx` หรือไฟล์ของฟีเจอร์

ข้อห้าม: เรียก `axios` หรือ `fetch` โดยตรง, ใช้สีจาก palette ตรง ๆ, เขียนข้อความบนหน้าจอลงในโค้ด, ใช้ `enum` ของ TypeScript

### ขั้นที่ 4: ตรวจและส่งมอบ

- `dotnet test`, `npm test`, `npm run lint`, `npm run format:check`, `npm run build` ผ่าน
- เปิดหน้าจอจริงในเบราว์เซอร์ทั้งโหมดสว่างและมืด และบนจอขนาดมือถือ
- อัปเดต README ที่เกี่ยวข้อง

## 4. Future Enhancements

จัดกลุ่มตาม milestone ใน [แผนแม่บท](02-master-plan.md) ลำดับภายในกลุ่มเป็นข้อเสนอ และกลุ่ม "เติบโต" ควรจัดใหม่หลังมีข้อมูลจากผู้ใช้จริง

### พร้อมใช้งานจริง

| รายการ | โมดูลที่กระทบ | ความซับซ้อน |
| --- | --- | --- |
| จัดการผู้ใช้และเปลี่ยนรหัสผ่าน | Authentication, โมดูลใหม่ Users | กลาง |
| จำกัดจำนวนครั้งที่ login ผิด | Authentication | ต่ำ |
| ป้องกันการตัดสต็อกผิดเมื่อขายพร้อมกัน | POS, Inventory | กลาง |
| สำรองข้อมูลอัตโนมัติ | Deploy | ต่ำ |
| เฝ้าระวังและแจ้งเตือนระบบล่ม | Deploy | ต่ำ |
| ลบ refresh token ที่หมดอายุ | Authentication | ต่ำ |
| End-to-end test ในเบราว์เซอร์และ test กับ PostgreSQL ใน CI | Test | กลาง |

### ธุรกิจครบวงจร

| รายการ | โมดูลที่กระทบ | ความซับซ้อน |
| --- | --- | --- |
| หน้าประวัติบิลและการยกเลิก | POS | ต่ำ (API มีแล้ว) |
| ใบเสร็จ: พิมพ์และ PDF | POS | กลาง |
| ส่วนลดรายสินค้าและท้ายบิล | POS | กลาง ต้องยืนยันสูตรภาษีก่อน |
| แต้มสะสมอัตโนมัติจากการขาย | POS, Customers | ต่ำ |
| รายงานและส่งออก `.xlsx` | โมดูลใหม่ Reports | กลาง |
| รูปสินค้า | Inventory | กลาง ต้องมีที่เก็บไฟล์ |
| นำเข้าสินค้าจากไฟล์ | Inventory | กลาง |
| ประวัติการปรับสต็อกและ audit trail | Inventory, ทุกโมดูล | กลาง |
| แบ่งหน้าที่ server | Inventory, Customers, POS | กลาง กระทบสัญญา API |
| แจ้งเตือนจากการแก้สต็อกเองและการยกเลิกบิล | Real-time | ต่ำ |
| หน้าจอ subscription ของร้าน | Subscriptions | ต่ำ (API มีแล้ว) |
| ข้อความ error จาก server เป็นภาษาของผู้ใช้ | ทุกโมดูล | กลาง |

### ขยายขนาดและ SaaS

| รายการ | โมดูลที่กระทบ | ความซับซ้อน |
| --- | --- | --- |
| ผู้ดูแลแพลตฟอร์ม | Authentication, Subscriptions | สูง |
| สมัครใช้งานเอง และ login ด้วยชื่อร้าน | Authentication | สูง |
| บังคับใช้ subscription และเก็บค่าบริการ | Subscriptions, โมดูลใหม่ Billing | สูง |
| รองรับ API หลาย instance | Real-time, Push, Deploy | กลาง |
| Observability | ทุกโมดูล | กลาง |

### เติบโต

หลายสาขาต่อร้าน, รับชำระเงินจากลูกค้าผ่าน QR และบัตร, เชื่อมเครื่องพิมพ์ใบเสร็จและลิ้นชักเงิน, สแกนบาร์โค้ดด้วยกล้อง,
ฟีเจอร์ร้านอาหาร (โต๊ะ, ครัว), ออฟไลน์สำหรับหน้าจออื่น, API สำหรับระบบภายนอก, การพยากรณ์สต็อก

## 5. เกณฑ์เลือกงานถัดไป

เมื่อต้องเลือกระหว่างหลายรายการ ให้ถามตามลำดับ:

1. ถ้าไม่ทำ ร้านจะเสียข้อมูลหรือเงินผิดหรือไม่ ถ้าใช่ ทำก่อน
2. มีการตัดสินใจเชิงธุรกิจค้างอยู่หรือไม่ ถ้ามี ให้ปิดการตัดสินใจก่อนเริ่ม
3. API มีอยู่แล้วหรือไม่ รายการที่เหลือแค่หน้าจอให้ผลเร็วที่สุด
4. เปลี่ยนสัญญา API หรือไม่ ถ้าใช่ ให้รวมกับงานอื่นที่เปลี่ยนส่วนเดียวกัน
