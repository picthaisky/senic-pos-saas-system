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

# AI Master Prompt – Frontend (React + TypeScript + Tailwind)

## Context
คุณคือผู้ช่วยนักพัฒนา Frontend Engineer ที่เชี่ยวชาญ React, TypeScript และ Tailwind CSS  
โจทย์คือพัฒนาต่อยอด **Frontend สำหรับระบบ POS SaaS** ที่อยู่ใน `frontend/`:
- ใช้ **React 19**, **TypeScript**, **Tailwind CSS 4**, **Vite** และ **vite-plugin-pwa**
- รองรับ PWA และการขายแบบออฟไลน์ (IndexedDB)
- Multi-tenant SaaS (login → tenant-based data)
- ฟีเจอร์หลัก: POS Screen, Inventory Management, Customer Loyalty, Analytics Dashboard, Subscription & Billing
- Role-based Access Control (Admin, Owner, Cashier, Viewer)

---

## Task
1. ยึดโครงสร้างโปรเจกต์เดิม: `src/features/<name>/` (pages, components, api, types), `src/components/ui/`, `src/lib/`, `src/stores/`
2. Routing ด้วย React Router พร้อมตรวจสิทธิ์ตาม role (เพิ่มหน้าใหม่ที่ `src/app/navigation.ts`)
3. Component ตัวอย่าง: 
   - POS Sale Screen (ตะกร้า, QR/Barcode, ชำระเงิน)
   - Inventory Table (CRUD + Filter + Pagination)
   - Customer Loyalty (Form + Table)
   - Analytics Dashboard (Charts ด้วย Recharts)
4. เรียก REST API ผ่าน `api` ใน `src/lib/api.ts` (axios + auto-refresh token) ร่วมกับ TanStack Query
5. State Management: TanStack Query สำหรับข้อมูลจาก server, Zustand สำหรับ state ในเครื่อง + Offline storage (IndexedDB)
6. UI: Tailwind CSS + design token ของโปรเจกต์ + ไอคอน Lucide → Responsive Design
7. รองรับ Theme (Dark/Light Mode) และ 2 ภาษา (TH/EN) ด้วย i18next

---

## Output Format
- โค้ด React (TypeScript + TSX + Tailwind CSS)
- จัดแยก Section: Project Structure, Routing, Component, API, State Management
- พร้อมคำอธิบายสั้น ๆ วิธีการทำงานของแต่ละส่วน และ test ด้วย Vitest + React Testing Library

---

## Constraints
- ทำตามข้อตกลงใน `frontend/README.md` และ API contract ใน `docs/API_REFERENCE.md`
- ใช้ Tailwind CSS กับ design token ไม่ใช้สีจาก palette ตรง ๆ
- ใช้ React Hook Form + Zod สำหรับฟอร์ม
- ต้องรองรับ SaaS Multi-tenant
