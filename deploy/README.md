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

ถ้ายังไม่ได้ตั้ง secret ของ Portainer เลย workflow `Deploy` จะ build และ push image ตามปกติ แล้วจบด้วยคำเตือน "Not deployed" โดยไม่ล้ม run ที่เป็นสีแดงบน `main` จึงหมายถึงมีบางอย่างเสียจริงเสมอ

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
- **Rollback**: ดูหัวข้อ "Rollback" ด้านล่าง
- **สำรองและกู้คืนฐานข้อมูล**: ดูหัวข้อ "สำรองและกู้คืนฐานข้อมูล" ด้านล่าง
- **Log ของ API**: ดูใน Portainer ที่ container `api` ไฟล์ log เก็บใน volume `api-logs`

## ตรวจ production หลัง deploy

ตั้ง Variable `SMOKE_URL` (เช่น `https://pos.example.com`) ใน environment `production` แล้ว workflow จะรัน
`deploy/smoke-test.mjs` โหมดอ่านอย่างเดียวหลัง deploy ทุกครั้ง ถ้าข้อใดไม่ผ่าน workflow จะ fail ให้เห็น

ถ้าเพิ่ม Secret `SMOKE_TENANT_ID`, `SMOKE_EMAIL`, `SMOKE_PASSWORD` ของบัญชี Owner หรือ Admin จะตรวจการ login
และการอ่านข้อมูลด้วย แนะนำให้สร้างบัญชีแยกสำหรับงานนี้ ถ้าไม่ใส่จะตรวจเฉพาะส่วนที่ไม่ต้อง login
workflow ไม่ rollback ให้เอง: เมื่อ fail ให้ทำตามหัวข้อ "Rollback"

## สำรองและกู้คืนฐานข้อมูล

Stack สำรองฐานข้อมูลเองสองแบบ เก็บใน volume `db-backups`:

| ไฟล์                                     | เกิดเมื่อ                                          | เก็บไว้                               |
| --------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| `predeploy-<เวลา UTC>-<IMAGE_TAG>.dump` | ทุกครั้งที่ deploy ก่อน API รุ่นใหม่จะ start และ migrate | 5 ไฟล์ล่าสุด (`BACKUP_KEEP_PREDEPLOY`) |
| `scheduled-<เวลา UTC>.dump`             | ทุก 24 ชั่วโมง (`BACKUP_INTERVAL_HOURS`)           | 14 วัน (`BACKUP_KEEP_DAYS`)          |
| `manual-*.dump`                         | สั่งเอง                                           | ไม่ถูกลบอัตโนมัติ                        |

- ถ้าการสำรองก่อน deploy ล้มเหลว API รุ่นใหม่จะไม่ start (ไม่มีข้อมูลสำรอง ก็ไม่ migrate) ดูสาเหตุที่ log ของ container `backup-before-deploy`
- Container `backup` เป็น unhealthy เมื่อไฟล์สำรองตามเวลาล่าสุดเกินกำหนดไปมากกว่า 2 ชั่วโมง
- **ไฟล์สำรองอยู่บน server เดียวกับฐานข้อมูล** ถ้า server หรือดิสก์เสีย จะเสียทั้งคู่ จนกว่าจะตั้งปลายทางนอก server ตามหัวข้อถัดไป
- เผื่อพื้นที่ดิสก์ประมาณ 20 เท่าของขนาดไฟล์ dump หนึ่งไฟล์

สั่งสำรองเองและดูรายการไฟล์ (ใน Portainer ใช้ Console ของ container `backup` หรือใช้ `docker exec`):

```bash
docker exec <container backup> sh -c 'pg_dump -Fc -f /backups/manual-$(date -u +%Y%m%dT%H%M%SZ).dump'
docker exec <container backup> ls -lh /backups
# คัดลอกไฟล์ออกมาที่เครื่อง
docker cp <container backup>:/backups/<ไฟล์>.dump .
```

### กู้คืน

การกู้คืนแทนที่ข้อมูลปัจจุบันทั้งหมดด้วยข้อมูลในไฟล์ สิ่งที่เกิดหลังเวลาของไฟล์นั้นหายไป

```bash
# 1. หยุด API และเว็บ เพื่อไม่ให้มีใครเขียนข้อมูลระหว่างกู้คืน
docker stop <container api> <container web>

# 2. สำรองสภาพปัจจุบันไว้ก่อน เผื่อเลือกไฟล์ผิด
docker exec <container backup> sh -c 'pg_dump -Fc -f /backups/manual-before-restore-$(date -u +%Y%m%dT%H%M%SZ).dump'

# 3. สร้างฐานข้อมูลใหม่แล้วกู้คืน
docker exec <container backup> sh -c 'dropdb --force SenicPosDb && createdb SenicPosDb && pg_restore --no-owner -d SenicPosDb /backups/<ไฟล์>.dump'

# 4. Start กลับ (หรือกด redeploy ใน Portainer) แล้วรัน smoke test
docker start <container api> <container web>
```

ต้องสร้างฐานข้อมูลใหม่ตามขั้นที่ 3 เสมอ อย่าใช้ `pg_restore --clean` ทับฐานเดิม: ตารางที่ migration รุ่นใหม่กว่าสร้างไว้
จะค้างอยู่ และ API รุ่นใหม่จะ migrate ซ้ำไม่ได้ (พบจากการซ้อม)

เมื่อ API start มันจะ migrate ฐานข้อมูลที่กู้คืนมาให้ตรงกับรุ่นของ image เอง จึงกู้ไฟล์จากรุ่นเก่ากว่าได้

ซ้อมแล้วเมื่อ 27 พฤศจิกายน 2026 บน stack ในเครื่อง: กู้ไฟล์ `predeploy` ของรุ่นก่อนหน้า แล้ว start API รุ่นใหม่
ระบบ migrate ต่อและ smoke test ผ่านครบ ฐานข้อมูลทดสอบมีข้อมูลน้อยมากจึงใช้เวลาไม่ถึงหนึ่งวินาที
**ยังไม่รู้เวลาที่ใช้กับข้อมูลขนาดจริง** ให้ซ้อมอีกครั้งเมื่อมีข้อมูลจริงและจดเวลาไว้
CI ซ้อมกู้คืนลงฐานข้อมูลเปล่าทุกครั้งที่รัน (job `stack`)

### รูปสินค้า

รูปที่ร้านอัปโหลดเก็บใน volume `uploads` ของ container `api` **ไม่อยู่ในไฟล์สำรองของฐานข้อมูล**

- เมื่อตั้งปลายทางนอก server ตามหัวข้อถัดไป `backup-offsite` คัดลอกรูปไปที่โฟลเดอร์ `uploads` ใต้ปลายทางเดียวกันทุก 5 นาที รูปที่ถูกลบในแอปยังอยู่ที่ปลายทาง
- ถ้าไม่ตั้งปลายทาง รูปมีอยู่บน server เครื่องเดียว ถ้าดิสก์เสีย สินค้ายังอยู่ครบจากไฟล์สำรองของฐานข้อมูล แต่รูปหาย ต้องอัปโหลดใหม่
- กู้รูปกลับบน server ใหม่ (หลังสร้าง stack ด้วยตัวแปรชุดเดิม):

```bash
docker compose -p senicpos run --rm --entrypoint sh -v senicpos_uploads:/restore backup-offsite -c \
  'rclone copy "offsite:$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/uploads" /restore'
```

### เก็บสำเนานอก server

Container `backup-offsite` คัดลอกไฟล์ `.dump` ทุกไฟล์ไปยังที่เก็บแบบ S3 (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO และผู้ให้บริการอื่นที่ใช้ API เดียวกัน)
**ปิดอยู่จนกว่าจะตั้ง `BACKUP_S3_BUCKET`** กำหนดปลายทางที่ตัวแปรของ stack ใน Portainer แล้วกด Update the stack:

| ตัวแปร                         | ความหมาย                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `BACKUP_S3_BUCKET`            | ชื่อ bucket ต้องสร้างไว้ก่อน และต้องเป็น private                                               |
| `BACKUP_S3_ACCESS_KEY_ID`     | Access key ควรสร้างเฉพาะสำหรับงานนี้ และเข้าได้เฉพาะ bucket นี้                                |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Secret ของ key ข้างบน                                                                   |
| `BACKUP_S3_ENDPOINT`          | ที่อยู่ S3 ของผู้ให้บริการ เช่น `https://<account>.r2.cloudflarestorage.com` เว้นว่างสำหรับ AWS S3 |
| `BACKUP_S3_REGION`            | AWS S3 ต้องใส่ (เช่น `ap-southeast-1`) ผู้ให้บริการอื่นส่วนใหญ่เว้นว่างได้                           |
| `BACKUP_S3_PROVIDER`          | `AWS`, `Cloudflare`, `Backblaze`, `Wasabi`, `Minio` หรือ `Other` (ค่าเริ่มต้น ใช้ได้กับส่วนใหญ่) |
| `BACKUP_S3_PREFIX`            | โฟลเดอร์ใน bucket ค่าเริ่มต้น `senic-pos` ใช้ชื่อต่างกันถ้าหลายระบบใช้ bucket เดียวกัน               |
| `BACKUP_OFFSITE_KEEP_DAYS`    | ลบสำเนาที่เก่ากว่านี้ ค่าเริ่มต้น 90 วัน ใส่ `0` เพื่อเก็บตลอด                                        |

- ตรวจทุก 5 นาที ไฟล์ที่ส่งแล้วไม่ถูกส่งซ้ำ ไฟล์ใหม่จึงไปถึงปลายทางภายในประมาณ 5 นาทีหลังสำรองเสร็จ
- ถ้าส่งไม่สำเร็จ จะลองใหม่ทุก 5 นาที และ container เป็น unhealthy เมื่อไม่มีการส่งสำเร็จเกิน 30 นาที ดูสาเหตุที่ log ของ `backup-offsite`
- Container นี้อ่าน volume `db-backups` ได้อย่างเดียว จึงทำไฟล์สำรองในเครื่องเสียไม่ได้
- ไฟล์สำรองมีข้อมูลลูกค้าและรหัสผ่านที่ hash แล้ว และ **ไม่ถูกเข้ารหัสก่อนส่ง** ให้เปิดการเข้ารหัสฝั่งผู้ให้บริการและอย่าเปิด bucket เป็นสาธารณะ
- ยืนยันหลังตั้งค่า: log ของ `backup-offsite` ต้องขึ้น `copying backups to offsite:...` และไฟล์ต้องปรากฏใน bucket

ดึงไฟล์จากปลายทางกลับมาเมื่อ server เดิมใช้ไม่ได้ (รันบน server ใหม่ที่สร้าง stack ด้วยตัวแปรชุดเดิมแล้ว):

```bash
# ดูว่ามีไฟล์อะไรอยู่ที่ปลายทาง
docker compose -p senicpos run --rm --entrypoint sh backup-offsite -c \
  'rclone lsl "offsite:$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX"'

# ดึงไฟล์ที่ต้องการลง volume db-backups แล้วกู้คืนตามขั้นตอนด้านบน
docker compose -p senicpos run --rm --entrypoint sh -v senicpos_db-backups:/restore backup-offsite -c \
  'rclone copy "offsite:$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX" /restore --include "scheduled-20261128T*.dump"'
```

ซ้อมแล้วกับที่เก็บ S3 จำลอง: ตั้งปลายทาง ไฟล์ไปถึงและ checksum ตรงกัน ดึงกลับมากู้คืนลงฐานข้อมูลเปล่าได้ และเมื่อปลายทางล่ม ไฟล์ในเครื่องไม่เสีย
ยังไม่ได้ลองกับผู้ให้บริการจริงรายใด

## Rollback

ใช้เมื่อรุ่นที่เพิ่ง deploy มีปัญหา

1. ใน Portainer แก้ตัวแปร `IMAGE_TAG` ของ stack เป็น tag ของรุ่นก่อนหน้า (`sha-...` ดูได้จากประวัติของ workflow Deploy
   หรือจากชื่อไฟล์ `predeploy-*`) แล้วกด **Pull and redeploy**
2. เปิด `/health` ดูว่า `version` เป็นรุ่นเก่าแล้ว และรัน smoke test
3. Revert commit ที่มีปัญหาใน `main` ด้วย ไม่เช่นนั้นการ deploy ครั้งถัดไปจะนำรุ่นที่มีปัญหากลับมา

**Rollback ไม่ย้อนฐานข้อมูล** รุ่นเก่าจะทำงานกับฐานข้อมูลที่ถูก migrate ไปแล้ว ซึ่งใช้ได้ตราบที่ทำตามกติกาด้านล่าง
ถ้ารุ่นใหม่ทำข้อมูลเสีย ให้กู้คืนจากไฟล์ `predeploy-*` ของการ deploy ครั้งนั้นตามหัวข้อ "กู้คืน"
โดยยอมเสียข้อมูลที่เกิดหลังจากนั้น (บิลที่ขายระหว่างนั้นต้องบันทึกใหม่)

ซ้อมแล้วเมื่อ 27 พฤศจิกายน 2026 บน stack ในเครื่อง: deploy รุ่นก่อนหน้า → อัปเกรดเป็นรุ่นที่มี migration ใหม่ →
rollback ด้วย `IMAGE_TAG` รุ่นก่อนหน้าทำงานกับฐานข้อมูลที่ migrate แล้วได้ smoke test โหมดเต็มผ่านทุกข้อที่รุ่นนั้นมี
ยังไม่ได้ซ้อมผ่าน Portainer จริง

### กติกาของ migration

Migration ทุกตัวต้องทำให้ **โค้ดรุ่นก่อนหน้าหนึ่งรุ่นยังทำงานได้กับฐานข้อมูลใหม่** เพื่อให้ rollback ได้โดยไม่ต้องกู้ข้อมูล

- **ทำได้ในรุ่นเดียว:** เพิ่มตาราง, เพิ่มคอลัมน์ที่เป็น null ได้หรือมีค่าเริ่มต้น, เพิ่ม index
- **ต้องแบ่งเป็นสองรุ่น:** ลบหรือเปลี่ยนชื่อคอลัมน์หรือตาราง, เปลี่ยนชนิดข้อมูล, เพิ่ม `NOT NULL` ให้คอลัมน์เดิม
  รุ่นแรกให้โค้ดเลิกใช้ของเก่า (และเขียนทั้งของเก่าและใหม่ถ้าจำเป็น) รุ่นถัดไปจึงลบของเก่า
- อย่าแก้ migration ที่ deploy ไปแล้ว ให้เพิ่มตัวใหม่เสมอ
- Migration ที่แก้ข้อมูลจำนวนมากให้ทดสอบกับสำเนาของข้อมูลจริงก่อน เพราะ API จะไม่รับงานจนกว่า migration จะจบ

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
