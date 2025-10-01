# POS SaaS System

## 📌 Overview
**POS SaaS (Point of Sale Software-as-a-Service)** คือระบบจัดการร้านค้าและร้านอาหารในรูปแบบ Subscription รายเดือน ที่สามารถใช้งานได้ทุกที่ทุกเวลา บน Cloud โดยออกแบบให้รองรับหลายผู้ใช้งาน (Multi-Tenant) และสามารถขยายระบบได้อย่างยืดหยุ่น

โครงการนี้ประกอบด้วย:
- **Backend API** → พัฒนาโดยใช้ `.NET Core 9` + `SQL Server`
- **Frontend** → พัฒนาโดยใช้ `Angular 20` + `Tailwind CSS` + `Angular Material`
- รองรับการ Deploy ด้วย Docker/Kubernetes
- มีเอกสาร Prompt แยกสำหรับ Backend และ Frontend เพื่อช่วยให้ AI สามารถ Generate/ออกแบบโค้ดตามหลัก Context Engineering

---

## 🚀 Features (High-Level)
- Multi-Tenant (ร้านค้าแต่ละเจ้าข้อมูลไม่ปนกัน)
- Subscription Management (สมัคร, ต่ออายุ, ยกเลิก, แจ้งเตือน)
- Product & Inventory Management
- Sales & POS Screen (บิลขาย, แสกนบาร์โค้ด, พิมพ์ใบเสร็จ)
- Customer Management & Loyalty Points
- Reports & Analytics (ยอดขาย, สต๊อก, พฤติกรรมลูกค้า)
- Integration (Payment Gateway, Email/Line Notify)
- Cloud-Ready: รองรับ Scaling บน Container

---

## 🏗️ Tech Stack
### Backend
- .NET Core 9 (C#)
- Entity Framework Core
- SQL Server
- RESTful API / GraphQL (optional)
- JWT Authentication, Role-Based Access
- Repository Pattern + Clean Architecture

### Frontend
- Angular 20 (TypeScript)
- Angular Material
- Tailwind CSS
- NgRx / Signals (State Management)
- PWA Ready + Responsive Design

### DevOps / Infra
- Docker, Docker Compose
- Kubernetes (Optional for Scaling)
- CI/CD (GitHub Actions / Azure DevOps / GitLab CI)

---

## 📂 Repository Structure
```plaintext
pos-saas-system/
│── backend/                  # Backend API (.NET Core 9 + SQL Server)
│── frontend/                 # Frontend (Angular 20 + Tailwind + Material)
│── prompts/                  # AI Context Engineering Prompts
│    ├── AI_PROMPT_BACKEND.md
│    └── AI_PROMPT_FRONTEND.md
│── docs/                     # Additional documentation (ERD, API spec, etc.)
│── docker-compose.yml        # Local deployment setup
│── README.md                 # Project overview (this file)

