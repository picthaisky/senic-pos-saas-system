# POS SaaS System

## 📌 Overview

**POS SaaS (Point of Sale Software-as-a-Service)** คือระบบจัดการร้านค้าและร้านอาหารในรูปแบบ Subscription รายเดือน
รองรับหลายร้านค้า (multi-tenant) โดยข้อมูลของแต่ละร้านแยกจากกัน

โครงการนี้ประกอบด้วย:

- **Backend API** → `.NET 9` + `Entity Framework Core` + `PostgreSQL`
- **Frontend** → `React 19` + `TypeScript` + `Tailwind CSS 4` + `Vite` (PWA ขายแบบออฟไลน์ได้)
- รองรับการ Deploy ด้วย Docker/Kubernetes
- มีเอกสาร Prompt แยกสำหรับ Backend และ Frontend เพื่อช่วยให้ AI สามารถ Generate/ออกแบบโค้ดตามหลักการเดียวกัน

---

## 🚀 Features

- **Multi-Tenant** – ร้านค้าแต่ละเจ้าข้อมูลไม่ปนกัน tenant อ่านจาก access token และถูกกรองที่ระดับฐานข้อมูล
- **Authentication & Authorization** – JWT access token, refresh token ใน HttpOnly cookie, สิทธิ์ตาม role
- **POS** – ค้นหาสินค้า, สแกนบาร์โค้ด, ตะกร้า, เลือกลูกค้าและวิธีชำระเงิน, กันบิลซ้ำ
- **Offline Selling** – ขายต่อได้เมื่อเน็ตหลุด บิลถูกเก็บในเครื่องแล้วส่งเมื่อกลับมาออนไลน์
- **Inventory Management** – เพิ่ม แก้ไข ลบ ค้นหา กรอง และแจ้งสินค้าใกล้หมด
- **Customer Loyalty** – สะสมและแลกแต้ม พร้อมประวัติ
- **Analytics Dashboard** – ยอดขายรายวัน, จำนวนบิล, สินค้าขายดี
- **Subscription Management** – ดูและต่ออายุ subscription ของร้าน
- **UI** – Responsive, Dark/Light theme, ภาษาไทยและอังกฤษ, ติดตั้งเป็นแอปได้ (PWA)

ยังไม่ได้ทำ: แจ้งเตือนแบบ real-time (SignalR), push notification, export Excel, ใบเสร็จ PDF, การจัดการผู้ใช้
รายการทั้งหมดอยู่ท้าย [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

---

## 🏗️ Tech Stack

### Backend

- .NET 9 (C#), ASP.NET Core Web API
- Entity Framework Core + PostgreSQL (migrations อยู่ใน repo)
- JWT Authentication, Role-Based Access
- Clean Architecture + Repository Pattern
- xUnit (unit test และ integration test ผ่าน HTTP)

### Frontend

- React 19, TypeScript, Vite
- Tailwind CSS 4 (design token, dark mode), Lucide icons
- React Router, TanStack Query, Zustand
- React Hook Form + Zod, i18next (TH/EN), Recharts
- vite-plugin-pwa (service worker) + IndexedDB สำหรับงานออฟไลน์
- Vitest + React Testing Library

### DevOps / Infra

- Docker, Docker Compose
- Kubernetes manifests (`backend/k8s/`)

---

## 📂 Repository Structure

```plaintext
senic-pos-saas-system/
│── backend/                  # Backend API (.NET 9)
│    ├── SenicPosSaaS.API/            # Controllers, authentication, startup
│    ├── SenicPosSaaS.Application/    # Services, DTOs
│    ├── SenicPosSaaS.Domain/         # Entities, repository interfaces
│    ├── SenicPosSaaS.Infrastructure/ # EF Core DbContext, repositories, migrations
│    ├── SenicPosSaaS.Tests/          # Unit and API integration tests
│    ├── docker-compose.yml           # PostgreSQL + API + web app
│    └── k8s/                         # Kubernetes manifests
│── frontend/                 # Frontend (React + TypeScript + Tailwind)
│    ├── src/app/            # App, router, navigation (menu and page permissions)
│    ├── src/features/       # auth, dashboard, pos, inventory, customers
│    ├── src/components/     # UI kit and layout
│    ├── src/lib/            # API client, formatting, helpers
│    ├── src/stores/         # Zustand stores
│    ├── Dockerfile          # nginx image serving the built app
│    └── README.md
│── docs/
│    ├── API_REFERENCE.md    # API contract between frontend and backend
│    └── prompts/            # AI Context Engineering Prompts
└── README.md
```

---

## 🚀 Quick Start

### Frontend only (no backend needed)

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

ค่าเริ่มต้นเป็นโหมดจำลอง (mock) ที่ตอบ API จากข้อมูลตัวอย่างในเบราว์เซอร์ login ด้วยรหัสร้าน อีเมล
และรหัสผ่านใดก็ได้ (อย่างน้อย 6 ตัวอักษร) รายละเอียดอยู่ใน [frontend/README.md](frontend/README.md)

### Full stack with Docker

```bash
cd backend
docker-compose up --build
# Web app: http://localhost:8080
# API + Swagger: http://localhost:5000/swagger
```

### Backend and frontend separately

```bash
# Backend (needs PostgreSQL, see backend/README.md)
cd backend
dotnet run --project SenicPosSaaS.API      # http://localhost:5247

# Frontend against the real backend
cd frontend
# in .env.development: VITE_USE_MOCKS=false, VITE_PROXY_TARGET=http://localhost:5247
npm run dev
```

เมื่อรันแบบ Development backend จะสร้างตารางและข้อมูลตัวอย่างให้เอง รวมถึงผู้ใช้ทดสอบของแต่ละ role
วิธี login อยู่ใน [backend/README.md](backend/README.md)

### Tests

```bash
cd backend && dotnet test
cd frontend && npm test
```

---

## 🔐 User Roles & Permissions

สิทธิ์เข้าหน้าจอใน frontend:

| Role    | Dashboard | POS | Inventory | Customers |
| ------- | --------- | --- | --------- | --------- |
| Admin   | ✅        | ✅  | ✅        | ✅        |
| Owner   | ✅        | ✅  | ✅        | ✅        |
| Cashier | ❌        | ✅  | ❌        | ❌        |
| Viewer  | ✅        | ❌  | ❌        | ❌        |

หลัง login แต่ละ role จะเข้าหน้าแรกที่ตัวเองมีสิทธิ์ (แคชเชียร์เข้าหน้า POS) สิทธิ์ของแต่ละ API endpoint
ซึ่งละเอียดกว่านี้ (เช่น แคชเชียร์เพิ่มลูกค้าและให้แต้มได้) อยู่ใน [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

---

## 🛠️ Architecture

### Frontend layers

```text
┌─────────────────────────────────────┐
│  Pages and components (React)       │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  Server data: TanStack Query        │
│  Local state: Zustand stores        │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  API client (axios, token refresh)  │
│  Offline catalog and order queue    │
└──────────────┬──────────────────────┘
       ┌───────┴────────┐
┌──────▼──────┐  ┌─────▼─────┐
│ Backend API │  │ IndexedDB │
└─────────────┘  └───────────┘
```

### Backend layers

```text
┌─────────────────────────────────────┐
│  API layer (controllers, JWT auth)  │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  Application layer (services, DTOs) │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  Domain layer (entities)            │
└──────────────┬──────────────────────┘
               │
┌──────────────┴──────────────────────┐
│  Infrastructure (EF Core,           │
│  repositories, tenant filter)       │
└──────────────┬──────────────────────┘
       ┌───────┴────────┐
       │   PostgreSQL   │
       └────────────────┘
```

---

## 📚 Documentation Index

- **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)** – API contract: endpoints, roles, request and response shapes, open issues
- **[frontend/README.md](frontend/README.md)** – Frontend setup, mock mode, offline behaviour, code conventions
- **[backend/README.md](backend/README.md)** – Backend setup, sign-in, configuration
- **[backend/ARCHITECTURE.md](backend/ARCHITECTURE.md)** – Clean architecture documentation
- **[backend/DEPLOYMENT.md](backend/DEPLOYMENT.md)** – Docker Compose and Kubernetes deployment
- **[docs/prompts/AI_PROMPT_FRONTEND.md](docs/prompts/AI_PROMPT_FRONTEND.md)** – Frontend AI context
- **[docs/prompts/AI_PROMPT_BACKEND.md](docs/prompts/AI_PROMPT_BACKEND.md)** – Backend AI context

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

### Coding Standards

- Frontend: follow the conventions in `frontend/README.md`; run `npm run lint`, `npm run format` and `npm test`
- Backend: follow C# coding conventions; run `dotnet test`
- Change `docs/API_REFERENCE.md` together with any change to an API endpoint
- Write meaningful commit messages and add tests for new features

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Authors & Contributors

- **Project Lead**: picthaisky

---

## 📞 Support

For support, questions, or feature requests:

- 📧 Email: [support@senicpos.com](mailto:support@senicpos.com)
- 🐛 Issues: [GitHub Issues](https://github.com/picthaisky/senic-pos-saas-system/issues)

---

## 🙏 Acknowledgments

- **React, Vite and Tailwind CSS** – For the frontend foundation
- **Microsoft** – For .NET and Entity Framework Core
- **Community** – For open-source libraries and tools
