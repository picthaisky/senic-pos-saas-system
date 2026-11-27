# Deploy ด้วย Docker Compose + Portainer (Git-based stack)

เอกสารนี้สำหรับคนที่ตั้งค่าและดูแล server ของ Senic POS

## ภาพรวม

```text
push เข้า main
   │
   ▼
GitHub Actions (.github/workflows/deploy.yml)
   1. รัน test ของ backend, frontend และไฟล์ deploy
   2. build image แล้ว push ขึ้น GHCR พร้อม tag ของ commit (sha-xxxxxxxxxxxx) และ latest
   3. สั่ง Portainer ให้ redeploy stack
   4. รอจน /health รายงานเวอร์ชันใหม่ (ถ้าตั้ง HEALTH_URL)
   │
   ▼
Portainer ดึง deploy/docker-compose.yml จาก Git repo นี้ แล้วรัน 3 container
   web (nginx + React)  →  api (.NET)  →  postgres
```

Stack เป็นแบบ **Git-based**: Portainer อ่านไฟล์ compose จาก repo โดยตรง การแก้ไฟล์ compose จึง deploy ด้วยขั้นตอนเดียวกับโค้ด

| ไฟล์                                     | หน้าที่                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| `deploy/docker-compose.yml`             | Stack ของ production                                    |
| `deploy/stack.env.example`              | รายการตัวแปรของ stack พร้อมคำอธิบาย                        |
| `deploy/portainer.mjs`                  | Script สั่ง Portainer: `create`, `deploy`, `wait-healthy` |
| `deploy/smoke-test.mjs`                 | ตรวจ stack ที่รันอยู่: โหมดอ่านอย่างเดียวและโหมดเต็ม             |
| `.github/workflows/ci.yml`              | Test ทุก pull request                                    |
| `.github/workflows/deploy.yml`          | Build image และ deploy เมื่อ push เข้า `main`              |
| `.github/workflows/portainer-stack.yml` | สร้าง stack ครั้งแรก (กดรันเอง)                             |

## สิ่งที่ต้องมีก่อน

- Server ที่มี Docker และ Portainer (ทดสอบการออกแบบกับ API ของ Portainer CE 2.x)
- **HTTPS reverse proxy** (เช่น Nginx Proxy Manager, Traefik, Caddy) ชี้มาที่ port ของ `web`
  ระบบ login ใช้ cookie แบบ `Secure` ถ้าเปิดผ่าน HTTP ธรรมดา ผู้ใช้จะหลุด login ทุกครั้งที่ reload
  และ push notification กับการติดตั้งเป็นแอปก็ต้องใช้ HTTPS
- GitHub Actions ต้องเรียก Portainer ได้ ถ้า Portainer อยู่ในเครือข่ายภายใน ดูหัวข้อ "Portainer ที่เข้าจากอินเทอร์เน็ตไม่ได้"

## ขั้นที่ 1: ให้ Portainer ดึง image ได้

Workflow push image ไปที่ `ghcr.io/picthaisky/senic-pos-saas-system-api` และ `-web`
Package ใหม่บน GHCR อาจเริ่มต้นเป็น private เลือกทางใดทางหนึ่ง:

- เปลี่ยน package เป็น public ที่ GitHub → Packages → Package settings → Change visibility
- หรือเพิ่ม registry ใน Portainer ที่ **Registries → Add registry** ใช้ `ghcr.io` กับ GitHub token ที่มีสิทธิ์ `read:packages`

Image จะมีหลัง workflow Deploy รันสำเร็จครั้งแรก (ขั้น build ทำงานได้แม้ยังไม่ได้ตั้งค่า Portainer ส่วนขั้น deploy จะ fail จนกว่าจะทำขั้นที่ 2–3)

## ขั้นที่ 2: เตรียมค่าความลับ

ดูรายการทั้งหมดใน [stack.env.example](stack.env.example) ค่าที่ต้องมี:

| ตัวแปร                      | ค่า                                                  |
| -------------------------- | --------------------------------------------------- |
| `POSTGRES_PASSWORD`        | รหัสผ่านฐานข้อมูล (ห้ามมี `;`)                            |
| `JWT_KEY`                  | ตัวอักษรสุ่มอย่างน้อย 32 ตัว เช่น `openssl rand -base64 48` |
| `BOOTSTRAP_TENANT_ID`      | UUID ของร้าน ผู้ใช้ต้องกรอกค่านี้ตอน login                  |
| `BOOTSTRAP_OWNER_EMAIL`    | อีเมลของผู้ใช้คนแรก (role Owner)                        |
| `BOOTSTRAP_OWNER_PASSWORD` | รหัสผ่านของผู้ใช้คนแรก อย่างน้อย 12 ตัวอักษร                 |

ระบบยังไม่มีหน้าจัดการผู้ใช้ ตัวแปร `BOOTSTRAP_*` จึงเป็นทางเดียวที่จะมีผู้ใช้คนแรก
API สร้างผู้ใช้นี้ครั้งเดียวตอน start ถ้าร้านนั้นยังไม่มีผู้ใช้เลย การ start ครั้งต่อไปจะไม่แตะรหัสผ่านเดิม
**หลัง login สำเร็จครั้งแรก ให้ลบ `BOOTSTRAP_OWNER_PASSWORD` ออกจาก stack**

## ขั้นที่ 3: สร้าง stack (ทำครั้งเดียว)

เลือกวิธีใดวิธีหนึ่ง

### วิธี A: ใน Portainer UI

1. **Stacks → Add stack** ตั้งชื่อ `senicpos` แล้วเลือก **Git Repository**
2. Repository: `https://github.com/picthaisky/senic-pos-saas-system` (repo เป็น public จึงไม่ต้องใส่ credential)
3. **Repository reference**: `refs/heads/main`
4. **Compose path**: `deploy/docker-compose.yml`
5. **Environment variables**: ใส่ค่าจากขั้นที่ 2
6. กด **Deploy the stack**

### วิธี B: ผ่าน GitHub Actions

1. ใน Portainer สร้าง access token: คลิกชื่อผู้ใช้มุมขวาบน → **My account** → **Access tokens** → **Add access token**
2. ใน GitHub ไปที่ **Settings → Environments** สร้าง environment ชื่อ `production` แล้วเพิ่ม:

   | ชนิด      | ชื่อ                         | ค่า                                                        |
   | -------- | -------------------------- | --------------------------------------------------------- |
   | Secret   | `PORTAINER_URL`            | เช่น `https://portainer.example.com`                       |
   | Secret   | `PORTAINER_API_KEY`        | access token จากข้อ 1                                      |
   | Secret   | `POSTGRES_PASSWORD`        |                                                           |
   | Secret   | `JWT_KEY`                  |                                                           |
   | Secret   | `BOOTSTRAP_OWNER_PASSWORD` |                                                           |
   | Variable | `PORTAINER_ENDPOINT_ID`    | เลข environment ใน Portainer (ดูจาก URL `#!/2/docker/...`) |
   | Variable | `BOOTSTRAP_TENANT_ID`      |                                                           |
   | Variable | `BOOTSTRAP_OWNER_EMAIL`    |                                                           |
   | Variable | `PORTAINER_STACK_NAME`     | ไม่ใส่ก็ได้ ค่าเริ่มต้นคือ `senicpos`                              |
   | Variable | `WEB_PORT`                 | ไม่ใส่ก็ได้ ค่าเริ่มต้นคือ `8080`                                  |

3. ไปที่ **Actions → Create Portainer stack → Run workflow**

Workflow นี้ไม่แก้ stack ที่มีอยู่แล้ว ถ้ามี stack ชื่อเดียวกันจะหยุดพร้อมข้อความแจ้ง

## ขั้นที่ 4: ตั้งค่าการ deploy อัตโนมัติ

ใน environment `production` ของ GitHub เลือกแบบใดแบบหนึ่ง

| แบบ             | ต้องตั้ง                                       | ผล                                                                          |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| **API (แนะนำ)** | Secret `PORTAINER_URL`, `PORTAINER_API_KEY` | Stack ถูกตรึงไว้ที่ image ของ commit นั้น (`IMAGE_TAG=sha-...`) รู้แน่ชัดว่ารันเวอร์ชันไหน |
| **Webhook**     | Secret `PORTAINER_WEBHOOK_URL`              | Portainer ดึง image `latest` ใหม่ ไม่ต้องให้ API key กับ GitHub                   |

แบบ Webhook: เปิด **GitOps updates** ใน stack เลือก Mechanism เป็น **Webhook** เปิด **Re-pull image** แล้วคัดลอกลิงก์มาใส่ใน secret
(หรือติ๊ก `enable_webhook` ตอนรัน workflow สร้าง stack แล้วคัดลอก URL จาก log)
URL นี้คือกุญแจ ใครมีก็สั่ง redeploy ได้ เอกสารของ Portainer บางหน้าระบุว่า stack webhook เป็นของ Business Edition
ถ้าใช้ Community Edition ให้ลองก่อนว่าใช้ได้ หรือใช้แบบ API

ตั้ง Variable `HEALTH_URL` (เช่น `https://pos.example.com/health`) เพื่อให้ workflow รอจนเวอร์ชันใหม่ทำงานจริง
ถ้าไม่ตั้ง workflow จะจบทันทีที่ Portainer รับคำสั่ง โดยไม่รู้ว่า deploy สำเร็จหรือไม่

ถ้าต้องการให้มีคนอนุมัติก่อน deploy ให้เพิ่ม **Required reviewers** ใน environment `production`

## การใช้งานประจำ

- **Deploy**: merge เข้า `main` (เฉพาะเมื่อมีการแก้ใน `backend/`, `frontend/`, `deploy/` หรือ workflow) หรือกด **Run workflow** ที่ Actions → Deploy
- **ดูว่ารันเวอร์ชันไหน**: เปิด `https://<โดเมน>/health` ดูค่า `version`
- **เฝ้าระวัง**: ให้บริการตรวจจากภายนอกเรียก `https://<โดเมน>/health/ready` ซึ่งตอบ `503` เมื่อ API ต่อฐานข้อมูลไม่ได้
  (`/health` ตอบว่าปกติตราบที่ตัวแอปยังทำงาน จึงไม่พอสำหรับการแจ้งเตือน)
- **เพิ่มหรือปิดบัญชีพนักงาน**: เจ้าของร้านทำเองได้ที่เมนู "ผู้ใช้งาน" บัญชีแรกของร้านยังมาจากตัวแปร `BOOTSTRAP_*`
- **จำนวน proxy หน้า API**: ตั้ง `FORWARD_LIMIT` ให้ตรงกับจำนวน proxy จริง (nginx ของ stack นี้ 1 ชั้น บวก reverse proxy HTTPS ถ้ามี)
  ถ้าตั้งน้อยไป ผู้ใช้ทุกคนจะถูกนับเป็น IP เดียวกันและโดนจำกัดการ login พร้อมกัน ถ้าตั้งมากไป ผู้โจมตีปลอม IP ได้
- **Rollback**: ใน Portainer แก้ตัวแปร `IMAGE_TAG` ของ stack เป็น tag เก่า (`sha-...`) แล้วกด **Pull and redeploy**
  การ deploy ครั้งถัดไปจาก `main` จะเขียนทับค่านี้ ถ้าปัญหาอยู่ในโค้ดให้ revert commit ด้วย
- **Rollback ไม่ย้อนฐานข้อมูล**: migration ที่รันไปแล้วไม่ถูกถอยกลับ ก่อน deploy ที่มี migration ให้สำรองข้อมูลก่อน
- **สำรองฐานข้อมูล**: ข้อมูลอยู่ใน volume `postgres-data` ยังไม่มีระบบสำรองอัตโนมัติ ตัวอย่างคำสั่งสำรองเอง:
  `docker exec <container ของ postgres> pg_dump -U postgres SenicPosDb > backup.sql`
- **Log ของ API**: ดูใน Portainer ที่ container `api` ไฟล์ log เก็บใน volume `api-logs`

## Portainer ที่เข้าจากอินเทอร์เน็ตไม่ได้

ถ้า GitHub Actions เรียก Portainer ไม่ได้ มี 2 ทาง:

- ใช้ self-hosted runner ในเครือข่ายเดียวกับ Portainer (แก้ `runs-on` ของ job `deploy`)
- ไม่ต้องให้ GitHub เรียกเข้ามา: ใน stack เปิด **GitOps updates** เลือก Mechanism เป็น **Polling** เปิด **Re-pull image** และ **Force redeployment**
  Portainer จะดึง image `latest` เองตามรอบเวลา วิธีนี้ job `deploy` ใน workflow จะ fail เพราะไม่มีอะไรให้เรียก ให้ลบ job นั้นออก

## ทดสอบ stack ในเครื่อง

```bash
# build image ด้วยชื่อที่ stack ใช้
docker build -t ghcr.io/picthaisky/senic-pos-saas-system-api:local backend
docker build -t ghcr.io/picthaisky/senic-pos-saas-system-web:local frontend

# คัดลอก stack.env.example เป็นไฟล์นอก repo ใส่ค่าจริง และตั้ง IMAGE_TAG=local
docker compose -p senicpos-local --env-file /path/to/stack.env -f deploy/docker-compose.yml up -d --wait

# เลิกใช้และลบข้อมูล
docker compose -p senicpos-local --env-file /path/to/stack.env -f deploy/docker-compose.yml down -v
```

บน `localhost` เบราว์เซอร์ยอมรับ cookie แบบ `Secure` ผ่าน HTTP จึง login ได้ตามปกติ

## ตรวจว่า stack ใช้งานได้ (smoke test)

`deploy/smoke-test.mjs` ตรวจ stack ที่รันอยู่ผ่านที่อยู่สาธารณะของมัน ไม่ต้องติดตั้งอะไรเพิ่มนอกจาก Node

```bash
# โหมดอ่านอย่างเดียว (ค่าเริ่มต้น): ไม่แก้ข้อมูล ใช้กับ production ได้
SMOKE_URL=https://pos.example.com \
SMOKE_TENANT_ID=... SMOKE_EMAIL=... SMOKE_PASSWORD=... node deploy/smoke-test.mjs

# โหมดเต็ม: สร้างสินค้า ลูกค้า และบิล ใช้กับ stack ทดสอบเท่านั้น
SMOKE_MODE=full SMOKE_URL=http://localhost:8080 ... node deploy/smoke-test.mjs
```

ถ้าไม่ใส่บัญชี จะตรวจเฉพาะส่วนที่ไม่ต้อง login (หน้าเว็บ, `/health`, การบังคับ login)
CI รันโหมดเต็มและ test ในเบราว์เซอร์กับ stack ที่ build จาก commit นั้นทุกครั้ง (job `stack` ใน `ci.yml`)

## ข้อจำกัดที่ควรรู้

- **API รันได้ instance เดียว** ใน stack นี้: มัน migrate ฐานข้อมูลเองตอน start และคิวของ push notification กับ SignalR อยู่ใน memory
- **มี downtime สั้น ๆ ตอน deploy** ระหว่างที่ container ถูกสร้างใหม่ หน้าขายยังทำงานต่อแบบออฟไลน์และส่งบิลเมื่อระบบกลับมา
- **Log แรกของ API บนฐานข้อมูลใหม่** จะมี error เรื่อง `__EFMigrationsHistory` หนึ่งครั้ง เป็นการตรวจว่ามีตารางหรือยัง ไม่ใช่ปัญหา
