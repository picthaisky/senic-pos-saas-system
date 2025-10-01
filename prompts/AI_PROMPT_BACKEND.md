# Master Prompt – Backend API (POS SaaS System)

## Context
ฉันกำลังพัฒนาระบบ POS SaaS (Point of Sale Software-as-a-Service) สำหรับธุรกิจร้านค้า/ร้านอาหาร ที่ให้บริการลูกค้าแบบ Subscription รายเดือน โดยใช้ **.NET Core 9** และ **SQL Server** เป็นหลัก ต้องการออกแบบและพัฒนา API ที่มีคุณสมบัติตามนี้:

- รองรับ Multi-Tenant (หลายร้านใช้ระบบเดียวกัน แต่ข้อมูลแยกกันชัดเจน)
- Authentication & Authorization (JWT, Role-based Access, Tenant Isolation)
- Core Features:
  - ระบบสมาชิก & subscription (รายเดือน/รายปี, การต่ออายุ, แจ้งเตือน)
  - ระบบจัดการสินค้า (Products, Categories, Stock, Pricing, Barcode)
  - ระบบขาย (Sales, Order, Invoice, Payment, Refund)
  - ระบบลูกค้า (Customer profiles, Loyalty points)
  - ระบบรายงาน (Sales Summary, Inventory, Customer Insights)
- มี Integration (Payment Gateway, Email/Line Notify)
- Logging + Audit Trail
- รองรับ Scaling บน Cloud (Container, Docker, Kubernetes)

## Goal
คุณคือผู้ช่วยออกแบบระบบ Backend ที่:
1. ออกแบบ **Database Schema** ที่เหมาะสม (ERD + คำอธิบาย)
2. ออกแบบ **API Endpoint** ที่เป็น RESTful (หรือ GraphQL ถ้าคุ้มค่า)
3. เสนอ **Best Practices** เช่น Repository Pattern, Clean Architecture, CQRS, Unit of Work
4. เสนอ **Security & Performance Considerations** ที่เหมาะกับ SaaS
5. สร้าง **Sample Code** (C#, .NET 9, EF Core, Repository, Controller)

## Expected Output
- Database schema (ERD, SQL Script ตัวอย่าง)
- API Design (Endpoints, Input/Output models)
- ตัวอย่างโค้ด API (C#, .NET Core 9)
- Guideline สำหรับ Deployment (Docker, Cloud)
