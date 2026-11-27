# Senic POS – Frontend (React)

React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + vite-plugin-pwa
แทนที่ frontend เดิม (Angular 20 ใน `../frontend/`) ซึ่งจะถูกลบเมื่อย้ายหน้าจอครบ

## เริ่มใช้งาน

```bash
npm install
npm run dev        # http://localhost:5173
```

Dev server ส่งต่อ `/api` และ `/hubs` ไปที่ backend ตามค่า `VITE_PROXY_TARGET` ใน `.env.development`

| รัน backend ด้วย   | ค่า `VITE_PROXY_TARGET`  |
| ---------------- | ----------------------- |
| `docker-compose` | `http://localhost:5000` |
| `dotnet run`     | `http://localhost:5247` |

## คำสั่ง

| คำสั่ง              | ทำอะไร                                              |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Dev server พร้อม HMR                                 |
| `npm run build`   | Type-check แล้ว build ลง `dist/` พร้อม service worker |
| `npm run preview` | เปิด `dist/` เพื่อทดสอบ PWA                            |
| `npm test`        | Vitest + React Testing Library                      |
| `npm run lint`    | oxlint                                              |
| `npm run format`  | Prettier                                            |

## โหมดจำลอง (mock)

Backend ยังไม่มีระบบ login ดังนั้น `.env.development` ตั้ง `VITE_USE_MOCKS=true` ไว้
เพื่อให้ `src/mocks/mock-api.ts` ตอบ `/api/auth/*` แทน ส่วน request อื่นยังวิ่งไป backend จริงผ่าน proxy

- ใช้รหัสร้าน อีเมล และรหัสผ่านใดก็ได้ (รหัสผ่านอย่างน้อย 6 ตัวอักษร)
- ขึ้นต้นอีเมลด้วย `admin@`, `cashier@` หรือ `viewer@` เพื่อทดสอบแต่ละ role อีเมลอื่นได้ role Owner
- เมื่อ backend มี `AuthController` แล้วให้ตั้งเป็น `false` โหมดนี้ไม่ถูกรวมใน production build

## โครงสร้าง

```
src/
├── app/                # App, router, navigation (เมนูและสิทธิ์ของแต่ละหน้า)
├── features/<name>/    # pages/, components/, api.ts ของแต่ละฟีเจอร์
├── components/ui/      # Button, Input, Select, Card, DataTable, Modal, Toaster, Spinner
├── components/layout/  # AppLayout, Sidebar, Topbar
├── lib/                # api (axios + auto-refresh), query-client, env, cn
├── stores/             # Zustand stores: auth, theme, toast
├── i18n/locales/       # th.json (ต้นแบบของ key), en.json
├── mocks/              # mock API สำหรับ dev
├── styles/index.css    # Tailwind + design tokens
└── test/setup.ts
```

## ข้อตกลงในโค้ด

- Import ภายในใช้ alias `@/` เช่น `@/lib/env`
- สีใช้ token (`bg-surface`, `text-fg`, `bg-primary`, `border-border`) ไม่ใช้สีจาก palette ตรง ๆ
  เพื่อให้ dark mode และ theme ของแต่ละ tenant ทำงานได้ ค่าอยู่ใน `src/styles/index.css`
- ห้ามใช้ `enum` (tsconfig เปิด `erasableSyntaxOnly`) ให้ใช้ union ของ string แทน
- ใน test ใช้ global ของ Vitest (`expect`, `vi`, `describe`) ไม่ต้อง import จาก `'vitest'`
  เหตุผลอยู่ใน `src/test/setup.ts`
- ข้อความบนหน้าจอทุกคำต้องผ่าน `t('...')` และเพิ่ม key ทั้งใน `th.json` และ `en.json`
- เพิ่มหน้าใหม่ที่ `src/app/navigation.ts` ที่เดียว เมนูและการตรวจสิทธิ์ของ route จะตามมาเอง
- เรียก API ผ่าน `api` จาก `@/lib/api` เท่านั้น เพื่อให้แนบ token และ refresh อัตโนมัติ
- API contract อยู่ที่ `../docs/API_REFERENCE.md`
