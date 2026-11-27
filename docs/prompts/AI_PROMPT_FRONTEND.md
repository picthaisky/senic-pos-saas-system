# Master Prompt – Frontend (POS SaaS System)

## Context
ฉันกำลังพัฒนาระบบ POS SaaS (Point of Sale Software-as-a-Service) โดยใช้ **React 19** + **TypeScript** + **Tailwind CSS 4** + **Vite** (PWA ด้วย `vite-plugin-pwa`) สำหรับฝั่ง Frontend ต้องการออกแบบ UI/UX ที่รองรับการใช้งานของร้านค้าและลูกค้าแบบ Subscription รายเดือน

โค้ดปัจจุบันอยู่ใน `frontend/` ให้ยึดโครงสร้างและข้อตกลงใน `frontend/README.md` และ API contract ใน `docs/API_REFERENCE.md`

## Core Features (UI Modules)
- Authentication & Login (Multi-Tenant, รองรับร้านค้าแต่ละเจ้า)
- Dashboard (ยอดขาย, สต๊อก, ลูกค้า, Subscription status)
- POS Screen (ขายสินค้า, ค้นหา, แสกนบาร์โค้ด, พิมพ์บิล, ขายแบบออฟไลน์)
- Product Management (เพิ่ม/แก้ไขสินค้า, อัปโหลดรูป, Import/Export)
- Order & Invoice Management
- Customer Management (โปรไฟล์ลูกค้า, Loyalty points)
- Subscription & Payment Management (สมัคร, ต่ออายุ, ยกเลิก)
- Reports (Sales chart, Inventory report, Customer insights)

## Goal
คุณคือผู้ช่วยออกแบบและพัฒนา Frontend ที่:
1. ออกแบบ **UI Layout** (Sidebar, Topbar, Main Content, Dark mode support)
2. ออกแบบ **Component Structure** แบบแยกตามฟีเจอร์ (`src/features/<name>/` มี pages, components, api, types) และใช้ component กลางจาก `src/components/ui/`
3. ใช้ **Tailwind CSS** กับ design token ของโปรเจกต์ (`bg-surface`, `text-fg`, `bg-primary`) และไอคอนจาก **Lucide** เพื่อให้ UI ดูสวยงาม ใช้ง่าย
4. เชื่อมต่อกับ API ที่ Backend จัดเตรียมให้ ผ่าน `api` ใน `src/lib/api.ts` และ **TanStack Query**
5. ใช้ **Zustand** สำหรับ state ฝั่ง client (auth, cart, theme) และ **React Hook Form + Zod** สำหรับฟอร์ม
6. สร้าง **Sample Code** (React 19, TypeScript, Tailwind) พร้อม test ด้วย **Vitest + React Testing Library**

## Expected Output
- Component Tree Diagram
- UI Mockup (wireframe หรือ component layout)
- ตัวอย่างโค้ด React (Page, Component, API hook, Route)
- Guideline การใช้ State Management (TanStack Query สำหรับข้อมูลจาก server, Zustand สำหรับ state ในเครื่อง)
- Best Practices สำหรับการทำ Responsive + PWA + Offline
- ข้อความบนหน้าจอทุกคำรองรับ 2 ภาษา (TH/EN) ผ่าน i18next
