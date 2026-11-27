# Senic POS – Frontend

React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + vite-plugin-pwa

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

## ใช้กับ backend จริง หรือโหมดจำลอง (mock)

`.env.development` ตั้ง `VITE_USE_MOCKS=true` ไว้ เพื่อให้เปิดหน้าจอได้โดยไม่ต้องรัน backend
โดย `src/mocks/` จะตอบทุก endpoint ใน contract จากข้อมูลตัวอย่างใน memory

**โหมดจำลอง** (`VITE_USE_MOCKS=true`)

- Login ด้วยรหัสร้าน อีเมล และรหัสผ่านใดก็ได้ (รหัสผ่านอย่างน้อย 6 ตัวอักษร)
- ขึ้นต้นอีเมลด้วย `admin@`, `cashier@` หรือ `viewer@` เพื่อทดสอบแต่ละ role อีเมลอื่นได้ role Owner
- ข้อมูลที่เพิ่ม แก้ หรือขาย จะหายเมื่อ reload หน้า และ mock ไม่ตรวจ role ฝั่ง API

**Backend จริง** (`VITE_USE_MOCKS=false`)

1. รัน backend ตาม `../backend/README.md` (ต้องมี PostgreSQL)
2. ตั้ง `VITE_USE_MOCKS=false` และ `VITE_PROXY_TARGET` ให้ตรงกับ port ของ backend แล้วรัน `npm run dev` ใหม่
3. Login ด้วยรหัสร้าน `11111111-1111-1111-1111-111111111111` และผู้ใช้ทดสอบ เช่น `owner@demo.test`
   รหัสผ่านอยู่ที่ `Seed:DemoPassword` ใน `../backend/SenicPosSaaS.API/appsettings.Development.json`

โหมดจำลองไม่ถูกรวมใน production build

## การทำงานแบบออฟไลน์

หน้า POS ขายต่อได้เมื่อเน็ตหลุดหรือเซิร์ฟเวอร์ล่ม ส่วนหน้าอื่นต้องออนไลน์

- **รายการสินค้า**: ทุกครั้งที่เปิดหน้า POS และเมื่อเน็ตกลับมา แอปจะดาวน์โหลดสินค้าที่เปิดขายเก็บไว้ในเครื่อง
  (IndexedDB) ตอนออฟไลน์การค้นหาและสแกนบาร์โค้ดจะใช้ข้อมูลชุดนี้ จำนวนคงเหลือจึงอาจไม่เป็นปัจจุบัน
- **บิลที่ขายตอนออฟไลน์**: ถูกเก็บเป็นคิวในเครื่อง และส่งให้อัตโนมัติเมื่อกลับมาออนไลน์ ดูคิวได้จากปุ่มบนแถบด้านบน
  แต่ละบิลมี `clientOrderId` เซิร์ฟเวอร์จึงไม่บันทึกซ้ำแม้ส่งหลายครั้ง
- **บิลที่เซิร์ฟเวอร์ไม่รับ** (เช่น สต็อกจริงไม่พอ): ค้างในคิวพร้อมเหตุผล ต้องมีคนกดลองใหม่หรือทิ้งรายการเอง
  ระบบไม่ส่งซ้ำให้อัตโนมัติ
- **การ login**: ถ้าเปิดแอปตอนติดต่อเซิร์ฟเวอร์ไม่ได้ แอปจะใช้ข้อมูลผู้ใช้คนล่าสุดของเครื่องนี้ต่อ (ไม่มี token)
  เพื่อให้ขายต่อได้ การ login ครั้งแรกและการออกจากระบบแล้วเข้าใหม่ต้องออนไลน์
- **อัปเดตเวอร์ชัน**: เมื่อมีเวอร์ชันใหม่จะมีแถบแจ้งให้กด "อัปเดต" แอปไม่ reload เองระหว่างขาย

ทดสอบได้ในโหมด mock: เปิด DevTools → Network → Offline แล้วลองขายในหน้า POS
ส่วน service worker (เปิดแอปได้โดยไม่มีเน็ต, ปุ่มติดตั้งแอป) ต้องทดสอบด้วย `npm run build && npm run preview`

## โครงสร้าง

```text
src/
├── app/                # App, router, navigation (เมนูและสิทธิ์ของแต่ละหน้า)
├── features/<name>/    # pages/, components/, api.ts ของแต่ละฟีเจอร์
├── components/ui/      # Button, Input, Select, Card, DataTable, Modal, Toaster, Spinner
├── components/layout/  # AppLayout, Sidebar, Topbar
├── lib/                # api (axios + auto-refresh), query-client, env, cn
├── stores/             # Zustand stores: auth, theme, toast
├── i18n/locales/       # th.json (ต้นแบบของ key), en.json
├── mocks/              # mock API สำหรับ dev และ test (mock-api = ตัวจับ route, mock-data = ข้อมูล)
├── styles/index.css    # Tailwind + design tokens
└── test/               # setup.ts, render-app.tsx (render ทั้งแอปพร้อม mock สำหรับ test)
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
