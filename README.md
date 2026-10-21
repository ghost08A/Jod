# Jod

แอปจดโน้ตแบบ "จดก่อน จัดทีหลัง" Note ซ้อนกันเป็น Tree ได้ และ AI ช่วยแนะนำที่วาง (รายละเอียดของ Product อยู่ใน [docs/product-spec.md](docs/product-spec.md))

## สถานะปัจจุบัน (ตรวจ 2026-10-20)

- **เสร็จแล้ว:** ฐานข้อมูล PostgreSQL, ระบบ session (Access token + Refresh token แบบหมุน + คุกกี้), **การเข้าสู่ระบบด้วย Google วิธีเดียว** ([ADR 0006](docs/adr/0006-google-sign-in-and-jod-session-tokens.md)) ทั้ง backend และหน้าเว็บ, กลุ่มปิดด้วยรายชื่ออีเมลที่อนุญาต, ตัวจัดการ error/log, CI
- **ตรวจด้วยเทสต์อัตโนมัติแล้ว แต่ยังไม่ได้ตรวจกับ Google จริง:** เทสต์ใช้ตัวตรวจ token ปลอม การตรวจ token จริงที่ Google เซ็นและการกดปุ่ม Google จริงบนเดสก์ท็อปและมือถือ ยังรอทำด้วยมือหลังมี OAuth Client ID (ดูหัวข้อ "เข้าสู่ระบบด้วย Google")
- Jod ไม่มีรหัสผ่าน ไม่มีหน้าสมัครสมาชิก และไม่ส่งอีเมล
- Note, Editor, Tree, AI ยังไม่ได้ทำ

## สิ่งที่ต้องติดตั้งก่อน

| โปรแกรม | รุ่น | ใช้ทำอะไร |
|---|---|---|
| Docker Desktop | รุ่นล่าสุด | รันฐานข้อมูล PostgreSQL |
| .NET SDK | 10 | รัน backend (`dotnet --version` ต้องขึ้น 10.x) |
| Node.js | 20.19 ขึ้นไป หรือ 22.12 ขึ้นไป (ทดสอบด้วย 24) | รันหน้าเว็บ |

คำสั่งทั้งหมดด้านล่างรันจากโฟลเดอร์ราก (`Jod/`) ใน terminal ที่ใช้ได้ทั้ง Git Bash และ PowerShell ยกเว้นที่ระบุไว้

## รันระบบครั้งแรก (ตั้งแต่เครื่องว่าง)

### 1. ตั้งรหัสผ่านฐานข้อมูล

คัดลอกไฟล์ตัวอย่างเป็น `.env` แล้วเปิดแก้ `POSTGRES_PASSWORD` เป็นรหัสที่คุณตั้งเอง (นี่คือรหัสผ่านของฐานข้อมูล ไม่เกี่ยวกับการเข้าสู่ระบบของผู้ใช้)

```bash
cp .env.example .env
```

(PowerShell: `Copy-Item .env.example .env`)

ถ้าพอร์ต 5432 ในเครื่องมีโปรแกรมอื่นใช้อยู่แล้ว (เช่น PostgreSQL ที่ติดตั้งในเครื่อง) ให้แก้ `POSTGRES_PORT` ในไฟล์เดียวกันเป็นเลขอื่น เช่น `5433`

ไฟล์ `.env` ห้ามแชร์หรือ commit (ระบบกันไว้ให้แล้ว)

### 2. เปิดฐานข้อมูล

```bash
docker compose up -d --wait
```

รอจนขึ้นว่า `Healthy` ฐานข้อมูลจะเปิดที่ `127.0.0.1` (เฉพาะเครื่องนี้ เครื่องอื่นเข้าไม่ได้)

### 3. ตั้งค่าลับของ backend

คัดลอกไฟล์ตัวอย่างเป็น `backend/Web.Jod/appsettings.Development.json` (ไฟล์นี้อยู่นอก git ห้าม commit)

```bash
cp backend/Web.Jod/appsettings.Development.example.json backend/Web.Jod/appsettings.Development.json
```

แล้วเปิดแก้ 4 ค่า (ค่าที่ 3 และ 4 อธิบายในหัวข้อ "เข้าสู่ระบบด้วย Google" ข้างล่าง)

1. `ConnectionStrings:Default` ใส่รหัสผ่านและพอร์ตให้ตรงกับที่ตั้งใน `.env` ข้อ 1
2. `Jwt:SigningKey` ใส่ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร (ใช้เซ็น Access token ที่ Jod ออกเอง) สร้างได้ด้วยคำสั่งใดคำสั่งหนึ่ง

   ```bash
   openssl rand -base64 48
   ```

   PowerShell:

   ```powershell
   $bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
   ```

3. `Google:ClientId` OAuth Client ID ของ Google (ยังไม่มีให้ใส่ค่าชั่วคราวที่ไม่ขึ้นต้น `REPLACE_WITH` เช่น `dev-placeholder.apps.googleusercontent.com` backend จะเริ่มได้ แต่ล็อกอินจริงยังไม่ได้)
4. `Access:AllowedEmails` รายชื่ออีเมล Google ที่อนุญาตให้ใช้ Jod

ถ้าไม่แก้ `Jwt:SigningKey` หรือยังเป็นค่า `REPLACE_WITH...` backend จะไม่ยอมเริ่มทำงาน เช่นเดียวกับ `Google:ClientId` ที่ว่างหรือยังเป็นค่าตัวอย่าง (ตั้งใจให้เป็นแบบนั้น) ส่วนบล็อก `Gemini` ยังไม่ใช้ในตอนนี้ ปล่อยไว้ได้

### 4. สร้างตารางในฐานข้อมูล

```bash
dotnet restore backend
dotnet tool restore
dotnet ef database update --project backend/Jod.Service --startup-project backend/Web.Jod
```

คำสั่งนี้สั่งซ้ำกี่ครั้งก็ได้ ไม่พัง

**ถ้าเคยรัน Jod รุ่นแรกที่ใช้อีเมล + รหัสผ่านไว้แล้ว** ตารางในฐานข้อมูลเป็นโครงเก่า (ตาราง `AspNet...`) ให้ลบฐานข้อมูลพัฒนาแล้วสร้างใหม่ก่อน (ข้อมูลในนั้นเป็นบัญชีทดลองทั้งหมดจะหาย)

```bash
dotnet ef database drop --force --project backend/Jod.Service --startup-project backend/Web.Jod
dotnet ef database update --project backend/Jod.Service --startup-project backend/Web.Jod
```

### 5. เปิด backend

```bash
dotnet run --project backend/Web.Jod --launch-profile http
```

backend อยู่ที่ <http://localhost:5133> (เปิดหน้า Swagger ดูรายการ API ได้ที่ <http://localhost:5133/swagger>) ปล่อย terminal นี้ไว้

### 6. เปิดหน้าเว็บ (เปิด terminal ใหม่)

ตั้ง Client ID ให้หน้าเว็บก่อน (ข้อ 4 ของหัวข้อ "เข้าสู่ระบบด้วย Google") แล้วค่อยรัน

```bash
cd client
npm ci
npm run dev
```

เปิดเบราว์เซอร์ที่ <http://localhost:5173>

### 7. ตรวจว่าระบบรันขึ้น

เปิดหน้าเว็บ จะถูกพาไปหน้าเข้าสู่ระบบที่มีปุ่ม "Sign in with Google" แปลว่าฐานข้อมูล backend และหน้าเว็บทำงานต่อกันได้ ถ้ายังใช้ Client ID ชั่วคราว ปุ่มจะขึ้นแต่กดเข้าจริงไม่ได้ ต้องใช้ Client ID จริงตามหัวข้อถัดไป

## เข้าสู่ระบบด้วย Google

Jod ใช้ Google Sign-In วิธีเดียว ([ADR 0006](docs/adr/0006-google-sign-in-and-jod-session-tokens.md), [spec 1a](docs/specs/1a-foundation-and-account.md)) หน้าเว็บส่ง Google ID token ให้ backend ตรวจเอง (ลายเซ็น, `aud`, `iss`, `exp`, `email_verified`) แล้ว Jod ออก token ของตัวเอง สิ่งที่ต้องเตรียม

1. **OAuth Client ID ชนิด Web application ใน Google Cloud Console** ใครเป็นเจ้าของโปรเจกต์ Google Cloud และสถานะของหน้าจอขอความยินยอม (consent screen) ยังเป็นคำถามที่เปิดอยู่ (OQ-13) และเงื่อนไขของโหมดทดสอบยังไม่ได้ตรวจกับเอกสาร Google
2. **Authorized JavaScript origins** ใส่ที่อยู่ที่ใช้เปิดหน้าเว็บในเบราว์เซอร์จริง ตอนพัฒนาคือที่อยู่ของ Vite (`http://localhost:5173`) เงื่อนไขของที่อยู่ (เช่น ต้องเป็น HTTPS นอกเครื่องตัวเองหรือไม่) ให้ตรวจกับเอกสาร Google ก่อนตั้งค่า
3. **ไม่ต้องใช้ Client Secret** เพราะหน้าเว็บส่ง Google ID token ให้ backend ตรวจเอง
4. ใส่ Client ID (ไม่ใช่ความลับ) สองที่ให้ตรงกัน: backend ค่า `Google:ClientId` ในไฟล์ `backend/Web.Jod/appsettings.Development.json` และหน้าเว็บ `VITE_GOOGLE_CLIENT_ID` ในไฟล์ `client/.env.local` (ไฟล์นี้อยู่นอก git คัดลอกรูปแบบจาก `client/.env.example`) ถ้าฝั่ง backend ไม่ตั้งหรือยังเป็นค่าตัวอย่าง backend จะไม่เริ่ม ถ้าฝั่งหน้าเว็บไม่ตั้ง หน้าเข้าสู่ระบบจะแจ้งว่ายังไม่ได้ตั้งค่า
5. **รายชื่ออีเมลที่อนุญาต** ค่า `Access:AllowedEmails` เป็นรายการอีเมล Google ของสมาชิกทุกคนที่จะใช้ Jod Jod เป็นกลุ่มปิด **รายชื่อว่าง = ไม่มีใครเข้าได้** (backend เริ่มได้แต่ขึ้น log เตือน) ไม่มีโหมดเปิดสมัครสาธารณะ รับเฉพาะ Gmail และบัญชี Google Workspace (บัญชี Google ที่ใช้อีเมลผู้ให้บริการอื่นเข้าไม่ได้ ตัดสินแล้วสำหรับ v1) อีเมลเทียบโดยไม่สนตัวพิมพ์เล็กใหญ่ การเอาอีเมลออกจากรายชื่อทำให้คนนั้นเสียสิทธิ์ภายในราว 15 นาที (ครั้งถัดไปที่ต่ออายุ session)

Jod ไม่ส่งอีเมลหาใครและไม่เก็บรหัสผ่านของใคร อีเมลใช้เป็นข้อมูลเท่านั้น (เทียบกับรายชื่อที่อนุญาต แสดงในหน้าบัญชี และเงื่อนไข Share Link แบบจำกัดด้วย email ในอนาคต)

## รันเทสต์และตรวจโค้ด

### backend

เทสต์ส่วนใหญ่ยิง API จริงใส่ PostgreSQL จริง จึงต้องบอกว่าฐานข้อมูลอยู่ที่ไหนผ่านตัวแปร `JOD_TEST_POSTGRES` (ใช้ฐานข้อมูลชื่อ `postgres` ของเซิร์ฟเวอร์ตัวเดียวกับข้อ 2 เทสต์จะสร้างฐานข้อมูลชั่วคราวของตัวเองและลบทิ้งเมื่อเสร็จ ไม่แตะฐานข้อมูลที่ใช้งานจริง)

Git Bash:

```bash
export JOD_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jod;Password=รหัสผ่านใน-.env"
cd backend
dotnet build
dotnet test
dotnet format --verify-no-changes
```

PowerShell: ใช้ `$env:JOD_TEST_POSTGRES = "..."` แทนบรรทัด `export`

ถ้าไม่ตั้ง `JOD_TEST_POSTGRES` เทสต์ส่วนที่ต้องใช้ฐานข้อมูลจะล้มพร้อมข้อความบอกวิธีแก้ (ไม่ข้ามเงียบๆ)

### หน้าเว็บ

```bash
cd client
npm run lint
npm run build
npm run test
```

### CI

ทุก PR ไป `dev`/`main` และทุก push เข้า `dev` จะรันตรวจทั้งหมดข้างบนบน GitHub Actions อัตโนมัติ (`.github/workflows/ci.yml`) การบังคับให้ CI ผ่านก่อน merge ต้องตั้งในหน้า Settings ของ GitHub เอง

## ปิดระบบ

```bash
docker compose down
```

ข้อมูลในฐานข้อมูลยังอยู่ (เก็บใน volume) เปิดใหม่ด้วย `docker compose up -d --wait` ถ้าต้องการ **ลบข้อมูลทั้งหมดและเริ่มใหม่** ใช้ `docker compose down -v` (ลบข้อมูลทั้งหมดในฐานข้อมูลของเครื่องนี้)

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `docker compose` บอกว่า `set POSTGRES_PASSWORD` | ยังไม่ได้ทำข้อ 1 หรือไฟล์ `.env` ไม่ได้อยู่ในโฟลเดอร์ราก |
| `port is already allocated` ตอนเปิดฐานข้อมูล | พอร์ต 5432 ถูกใช้อยู่ แก้ `POSTGRES_PORT` ใน `.env` แล้วแก้พอร์ตใน `ConnectionStrings:Default` ให้ตรงกัน |
| backend ไม่เริ่ม ขึ้นข้อความเกี่ยวกับ `Jwt:SigningKey` | ยังไม่ได้ตั้งกุญแจ สั้นกว่า 32 ไบต์ หรือยังเป็นค่าตัวอย่าง (ข้อ 3) |
| backend ไม่เริ่ม ขึ้น `ConnectionStrings:Default is not set` | ยังไม่ได้สร้าง `appsettings.Development.json` (ข้อ 3) หรือรันนอกโหมด Development |
| backend ไม่เริ่ม ขึ้นข้อความเกี่ยวกับ `Google:ClientId` หรือ `Access:AllowedEmails` | `Google:ClientId` ว่างหรือยังเป็นค่าตัวอย่าง หรือมีรายการในรายชื่อที่ไม่ใช่อีเมล (ข้อ 3) |
| backend ขึ้นข้อผิดพลาดเกี่ยวกับตารางหรือคอลัมน์ที่ไม่มี | ฐานข้อมูลยังเป็นโครงของรุ่นแรก ลบแล้วสร้างใหม่ตามข้อ 4 |
| หน้าเข้าสู่ระบบแจ้ง "ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID" | ยังไม่ได้สร้าง `client/.env.local` หรือเปิด `npm run dev` ไว้ก่อนสร้าง ให้ปิดแล้วเปิดใหม่ |
| ล็อกอิน Google สำเร็จแต่ขึ้น "ยังไม่ได้รับอนุญาตให้ใช้ Jod" (403) | อีเมลของบัญชีนั้นไม่อยู่ใน `Access:AllowedEmails` ให้เพิ่มแล้วเปิด backend ใหม่ |
| ขึ้น "ตรวจสอบกับ Google ไม่ได้ชั่วคราว" (503) | backend ติดต่อ Google เพื่อดึงกุญแจตรวจ token ไม่ได้ (ไม่มีอินเทอร์เน็ตหรือ Google ขัดข้อง) ลองใหม่ |
| หน้าเว็บขึ้น "เชื่อมต่อระบบไม่ได้" | backend ยังไม่เปิด (ข้อ 5) หรือเปิดคนละพอร์ต หน้าเว็บส่งคำขอไปที่ `localhost:5133` |
| ขึ้น "ส่งคำขอถี่เกินไป" (429) | ระบบจำกัดการเข้าสู่ระบบ 10 ครั้งต่อนาทีต่อเครื่อง (ต่ออายุเงียบ 60 ครั้ง) รอ 1 นาทีแล้วลองใหม่ |
| เทสต์ backend ล้มด้วยข้อความ `Set JOD_TEST_POSTGRES` | ยังไม่ได้ตั้งตัวแปรตามหัวข้อรันเทสต์ |

## เอกสารอื่น

- [CLAUDE.md](CLAUDE.md) กติกาการทำงานของ repo นี้ (รวมกฎความปลอดภัยและ Definition of Done) และ [backend/CLAUDE.md](backend/CLAUDE.md), [client/CLAUDE.md](client/CLAUDE.md) ของแต่ละฝั่ง
- [docs/product-spec.md](docs/product-spec.md) ข้อกำหนดของ Product, [docs/adr/](docs/adr/) การตัดสินใจทางเทคนิคที่ย้อนกลับยาก, [docs/specs/](docs/specs/) spec ของแต่ละช่วงงาน
