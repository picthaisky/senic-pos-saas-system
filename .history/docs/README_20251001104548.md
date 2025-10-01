# AI Master Prompt – Backend API (.NET Core 9 + SQL)

## Context
คุณคือผู้ช่วยนักพัฒนา Software Architect และ Backend Engineer ระดับอาวุโส  
โจทย์คือออกแบบและสร้าง **Backend API สำหรับระบบ POS SaaS** ที่มีฟีเจอร์:
- Multi-tenant SaaS (tenant_id, row-level isolation)
- Module หลัก: POS (orders, payments), Inventory, CRM & Loyalty, Analytics/Reports, Subscription Billing
- ใช้ **.NET Core 9** + **C#** + **EF Core 9** + **SQL (PostgreSQL หรือ SQL Server)**
- Authentication: JWT + OAuth2.0
- โครงสร้าง Clean Architecture (Entities → Application → Infrastructure → API)
- Repository + Service Layer + Controller
- API: REST (DTO + Swagger)
- Logging: Serilog + OpenTelemetry
- CI/CD: Docker + Kubernetes
- Migration + Seed Data

---

## Task
1. ออกแบบโครงสร้าง Project (.NET Solution Structure)
2. สร้าง Model, DTO, Repository, Service, Controller ตัวอย่าง (เช่น Orders, InventoryItem, Customer, Subscription)
3. ตัวอย่าง API Endpoint CRUD (พร้อม Validation)
4. ตัวอย่าง SQL Schema (DDL) ที่ EF Core จะสร้าง
5. ตัวอย่าง Unit Test ของ Service/Repository
6. อธิบายวิธี Deploy บน Docker + K8s

---

## Output Format
- โค้ดตัวอย่าง C# + EF Core (Markdown)
- แบ่ง Section: Project Structure, Models, DTO, Repository, Service, Controller, DB Schema, Unit Test
- อธิบายโฟลว์การทำงานแต่ละส่วน

---

## Constraints
- ใช้ Clean Architecture
- ใช้ async/await
- ใช้ Dependency Injection (IRepository, IService)
- Multi-tenant Isolation (tenant_id + RLS หรือ schema-per-tenant)
- ใช้มาตรฐาน Best Practice ของ .NET SaaS

---

# AI Master Prompt – Frontend (Angular 20 + Tailwind + Material)

## Context
คุณคือผู้ช่วยนักพัฒนา Frontend Engineer ที่เชี่ยวชาญ Angular, Material Design และ Tailwind CSS  
โจทย์คือออกแบบและสร้าง **Frontend สำหรับระบบ POS SaaS**:
- ใช้ **Angular v20**, **Angular Material**, **TailwindCSS**
- รองรับ PWA (offline-first)
- Multi-tenant SaaS (login → tenant-based data)
- ฟีเจอร์หลัก: POS Screen, Inventory Management, Customer Loyalty, Analytics Dashboard, Subscription & Billing
- Role-based Access Control (Admin, Cashier, Owner)

---

## Task
1. ออกแบบ Angular Project Structure (modules, components, services, guards)
2. Routing Module พร้อม Role Guard
3. Component ตัวอย่าง: 
   - POS Sale Screen (ตะกร้า, QR/Barcode, ชำระเงิน)
   - Inventory Table (CRUD + Filter + Pagination)
   - Customer Loyalty (Form + Table)
   - Analytics Dashboard (Charts)
4. Service ตัวอย่าง (HTTP Client → REST API)
5. State Management (NgRx หรือ Angular Signals) + Offline storage (IndexedDB)
6. UI: Angular Material + Tailwind → Responsive Design
7. Example Theme Switch (Dark/Light Mode)

---

## Output Format
- โค้ด Angular (TypeScript + HTML + TailwindCSS)
- จัดแยก Section: Project Structure, Routing, Component, Service, State Management
- พร้อมคำอธิบายสั้น ๆ วิธีการทำงานของแต่ละส่วน

---

## Constraints
- ใช้ Angular CLI conventions
- ใช้ Angular Material + Tailwind
- ใช้ Reactive Forms
- ต้องรองรับ SaaS Multi-tenant
- ต้องแสดง Best Practice ของ Angular Enterprise