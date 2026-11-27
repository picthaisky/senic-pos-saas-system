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

## โครงสร้าง

```
src/
├── app/                # App, router, providers
├── features/<name>/    # pages/, components/, api.ts, types.ts ของแต่ละฟีเจอร์
├── components/ui/      # Button, Input, Table, Modal ...
├── components/layout/  # Sidebar, Topbar
├── lib/                # env, axios client, offline db
├── stores/             # Zustand stores (auth, cart, theme)
├── i18n/locales/       # th.json, en.json
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
- API contract อยู่ที่ `../docs/API_REFERENCE.md`
