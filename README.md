# Jod

แอปจดโน้ตแบบ "จดก่อน จัดทีหลัง" Note ซ้อนกันเป็น Tree ได้ และ AI ช่วยแนะนำที่วาง (รายละเอียดของ Product อยู่ใน [docs/product-spec.md](docs/product-spec.md))

## สถานะปัจจุบัน (ตรวจ 2026-10-20)

- **เสร็จแล้ว:** ฐานข้อมูล PostgreSQL, โครงระบบ session (Access token + Refresh token แบบหมุน + คุกกี้), หน้าเว็บส่วน session, ตัวจัดการ error/log, CI
- **ยังไม่เสร็จ (งานที่ค้างอยู่): การเข้าสู่ระบบด้วย Google** Jod จะใช้ **Google Sign-In เป็นวิธีเข้าสู่ระบบวิธีเดียว** ([ADR 0006](docs/adr/0006-google-sign-in-and-jod-session-tokens.md)) แต่ยังไม่ได้เขียนโค้ดส่วนนี้ ตอนนี้ **ยังไม่มีทางเข้าสู่ระบบที่ใช้งานได้จริง** คู่มือนี้จึงพาไปถึงขั้น "ระบบรันขึ้นและเห็นหน้าเข้าสู่ระบบ" เท่านั้น
- โค้ดรุ่นแรกในเครื่องยังมีระบบ email + รหัสผ่าน ซึ่งเป็น **โค้ดเก่าที่ต้องถอดออก** ไม่ใช่วิธีเข้าสู่ระบบของ Jod และคู่มือนี้ไม่สอนให้ตั้งค่าหรือใช้ ([แผนถอด](docs/specs/1a-foundation-and-account.md) หัวข้อ 17)
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

แล้วเปิดแก้ 2 ค่า

1. `ConnectionStrings:Default` ใส่รหัสผ่านและพอร์ตให้ตรงกับที่ตั้งใน `.env` ข้อ 1
2. `Jwt:SigningKey` ใส่ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร (ใช้เซ็น Access token ที่ Jod ออกเอง) สร้างได้ด้วยคำสั่งใดคำสั่งหนึ่ง

   ```bash
   openssl rand -base64 48
   ```

   PowerShell:

   ```powershell
   $bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
   ```

ถ้าไม่แก้ `Jwt:SigningKey` หรือยังเป็นค่า `REPLACE_WITH...` backend จะไม่ยอมเริ่มทำงาน (ตั้งใจให้เป็นแบบนั้น)

**ในไฟล์ที่คัดลอกมีบล็อก `Registration` ให้ลบทิ้ง** บล็อกนี้เป็นของระบบสมัครสมาชิกแบบเก่าที่กำลังถูกถอด ไม่ต้องตั้งหรือแก้ค่าใดๆ (ไม่มีบล็อกนี้ backend ก็เริ่มได้) ส่วนบล็อก `Gemini` ยังไม่ใช้ในตอนนี้ ปล่อยไว้ได้

### 4. สร้างตารางในฐานข้อมูล

```bash
dotnet restore backend
dotnet tool restore
dotnet ef database update --project backend/Jod.Service --startup-project backend/Web.Jod
```

คำสั่งนี้สั่งซ้ำกี่ครั้งก็ได้ ไม่พัง

### 5. เปิด backend

```bash
dotnet run --project backend/Web.Jod --launch-profile http
```

backend อยู่ที่ <http://localhost:5133> (เปิดหน้า Swagger ดูรายการ API ได้ที่ <http://localhost:5133/swagger>) ปล่อย terminal นี้ไว้

### 6. เปิดหน้าเว็บ (เปิด terminal ใหม่)

```bash
cd client
npm ci
npm run dev
```

เปิดเบราว์เซอร์ที่ <http://localhost:5173>

### 7. ตรวจว่าระบบรันขึ้น

เปิดหน้าเว็บ จะถูกพาไปหน้าเข้าสู่ระบบ นั่นแปลว่าฐานข้อมูล backend และหน้าเว็บทำงานต่อกันได้ ฟอร์มอีเมล/รหัสผ่านที่เห็นเป็น **ของโค้ดเก่าที่ต้องถอด ไม่ต้องสมัครหรือกรอก** ตอนนี้ยังเข้าสู่ระบบไม่ได้จนกว่าการเข้าสู่ระบบด้วย Google จะถูก implement (ดูหัวข้อถัดไป)

## เข้าสู่ระบบด้วย Google (งานที่ยังไม่เสร็จ)

**หัวข้อนี้เป็นแผนตามที่ตัดสินใจไว้ใน [ADR 0006](docs/adr/0006-google-sign-in-and-jod-session-tokens.md) และ [spec 1a](docs/specs/1a-foundation-and-account.md) ยังทำตามไม่ได้ในโค้ดตอนนี้** ชื่อค่าตั้งค่าด้านล่างเป็นร่างและอาจเปลี่ยนตอน implement หัวข้อนี้จะถูกเขียนใหม่เป็นขั้นตอนใช้งานจริงเมื่อโค้ดเสร็จ

สิ่งที่จะต้องเตรียมเมื่อถึงเวลา

1. **OAuth Client ID ชนิด Web application ใน Google Cloud Console** ใครเป็นเจ้าของโปรเจกต์ Google Cloud และสถานะของหน้าจอขอความยินยอม (consent screen) ยังเป็นคำถามที่เปิดอยู่ (OQ-13) และเงื่อนไขของโหมดทดสอบยังไม่ได้ตรวจกับเอกสาร Google
2. **Authorized JavaScript origins** ใส่ที่อยู่ที่ใช้เปิดหน้าเว็บในเบราว์เซอร์จริง ตอนพัฒนาคือที่อยู่ของ Vite (`http://localhost:5173`) เงื่อนไขของที่อยู่ (เช่น ต้องเป็น HTTPS นอกเครื่องตัวเองหรือไม่) ให้ตรวจกับเอกสาร Google ก่อนตั้งค่า
3. **ไม่ต้องใช้ Client Secret** เพราะหน้าเว็บส่ง Google ID token ให้ backend ตรวจเอง
4. ใส่ Client ID (ไม่ใช่ความลับ) ที่ backend ค่า `Google:ClientId` ในไฟล์ `appsettings.Development.json` และที่หน้าเว็บ `VITE_GOOGLE_CLIENT_ID` ในไฟล์ `client/.env` (ชื่อเป็นร่าง) ถ้าไม่ตั้งหรือยังเป็นค่าสมมติ backend จะไม่เริ่ม
5. **รายชื่ออีเมลที่อนุญาต** ค่า `Access:AllowedEmails` (ชื่อเป็นร่าง) ใส่อีเมล Google ของสมาชิกทุกคนที่จะใช้ Jod Jod เป็นกลุ่มปิด **รายชื่อว่าง = ไม่มีใครเข้าได้** ไม่มีโหมดเปิดสมัครสาธารณะ ตามร่างปัจจุบันรับเฉพาะ Gmail และบัญชี Google Workspace (OQ-11 ยังไม่ตัดสิน) และการเอาอีเมลออกจากรายชื่อทำให้คนนั้นเสียสิทธิ์ภายในราว 15 นาที

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
| หน้าเว็บขึ้น "เชื่อมต่อระบบไม่ได้" | backend ยังไม่เปิด (ข้อ 5) หรือเปิดคนละพอร์ต หน้าเว็บส่งคำขอไปที่ `localhost:5133` |
| ขึ้น "ส่งคำขอถี่เกินไป" (429) | ระบบจำกัดการเข้าสู่ระบบ 10 ครั้งต่อนาทีต่อเครื่อง (ต่ออายุเงียบ 60 ครั้ง) รอ 1 นาทีแล้วลองใหม่ |
| เทสต์ backend ล้มด้วยข้อความ `Set JOD_TEST_POSTGRES` | ยังไม่ได้ตั้งตัวแปรตามหัวข้อรันเทสต์ |

## เอกสารอื่น

- [CLAUDE.md](CLAUDE.md) กติกาการทำงานของ repo นี้ (รวมกฎความปลอดภัยและ Definition of Done) และ [backend/CLAUDE.md](backend/CLAUDE.md), [client/CLAUDE.md](client/CLAUDE.md) ของแต่ละฝั่ง
- [docs/product-spec.md](docs/product-spec.md) ข้อกำหนดของ Product, [docs/adr/](docs/adr/) การตัดสินใจทางเทคนิคที่ย้อนกลับยาก, [docs/specs/](docs/specs/) spec ของแต่ละช่วงงาน
