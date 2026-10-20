# to-spec 1a: โครงระบบและบัญชีผู้ใช้

สถานะ: **ร่างรอผู้ใช้ตรวจ** (2026-10-20) ยังไม่เขียนโค้ด ยังไม่ commit

ป้ายกำกับในเอกสารนี้

- **[ตัดสินแล้ว]** ผู้ใช้ยืนยันแล้ว (อ้างแหล่ง) รวมถึง Q1–Q12 ที่ยืนยันเมื่อ 2026-10-20
- **[ร่าง]** รายละเอียดที่ผู้ช่วยเสนอและผู้ใช้ให้เขียนลงไฟล์เพื่อตรวจ ยังไม่ใช่ Decision จนกว่าผู้ใช้อนุมัติไฟล์นี้
- **[ยังไม่ได้ตรวจ]** ข้อเท็จจริงที่ยังไม่มีหลักฐานทดสอบ

## 0. ที่มาและหลักฐาน (ตรวจจากไฟล์และแหล่งอ้างอิงจริง 2026-10-20)

- ขอบเขต 1a กำหนดโดยผู้ใช้: บัญชีผู้ใช้ Authentication/Authorization, PostgreSQL, Docker Compose และ CI ส่วน 1b (Note พื้นฐาน, Block schema ขั้นต่ำ, Autosave, ตรวจบันทึกชนกัน, Editor บนเดสก์ท็อปและมือถือ) ทำ to-spec แยกหลัง 1a ผ่านการตรวจรับ
- สถานะโค้ดปัจจุบัน: `backend/` และ `client/` มีเฉพาะตัวอย่าง WeatherForecast (`Web.Jod`, `Jod.Service`, `Jod.Domain`, `Jod.Service.Tests` ทุกโปรเจกต์เป็น `net8.0`) ไม่มี CI ไม่มี Dockerfile/compose ไม่มี `.env.example` ระดับราก
- Vite proxy `/api` ไป `http://localhost:5133` (หน้าเว็บกับ API เป็นแหล่งเดียวกันตอนพัฒนา) Vitest ตั้ง `environment: 'node'` และรวมเฉพาะ `src/**/*.test.ts` (ทดสอบตรรกะล้วนได้ ทดสอบ component ใน DOM ไม่ได้ เพราะยังไม่มี jsdom)
- .NET 8 หมดซัพพอร์ต 2026-11-10 ส่วน .NET 10 (LTS) ถึง 2028-11-14 (หน้านโยบาย .NET ของ Microsoft) จึงมี ADR 0010
- `MapIdentityApi` ของ Microsoft ใช้โทเคนเฉพาะที่ไม่ใช่ JWT และเอกสารระบุว่าเหมาะกับกรณีง่าย จึงไม่ใช้ในโปรเจกต์นี้ (ตาม ADR 0006 ใช้ JWT + Refresh token ที่ Jod ออกเอง)
- Web Locks API ใช้ได้ทั่วไปตั้งแต่ มี.ค. 2022 แต่เฉพาะบริบทที่ปลอดภัย (HTTPS หรือ localhost) (MDN)

## 1. ขอบเขต

| | อยู่ใน 1a | ไม่อยู่ใน 1a |
|---|---|---|
| บัญชีและความปลอดภัย | สมัคร, ล็อกอิน, ออกจากระบบ, ต่ออายุโทเคน (หมุนทุกครั้ง + ตรวจการใช้ซ้ำ), `GET /api/me`, นโยบายค่าเริ่มต้น "ต้องล็อกอิน", ตัวช่วย "ผู้ใช้ปัจจุบัน" สำหรับ 1b | ยืนยันอีเมล/ลืมรหัสผ่าน (1c), เปลี่ยนรหัสผ่าน, ออกจากทุกอุปกรณ์ |
| ข้อมูล | PostgreSQL + EF Core + migration, ตารางผู้ใช้ (Identity) และ Refresh token | ตาราง Note/Block/ไฟล์/ลิงก์ |
| หน้าเว็บ | หน้าสมัคร/ล็อกอิน/ออก และหน้าที่ต้องล็อกอินแสดงอีเมล (ไว้ตรวจรับกลไกโทเคน) ธีมมืด ใช้ได้บนมือถือ | Editor, Tree, layout แถบข้าง (1b) |
| โครงระบบ | `docker-compose.yml` (Postgres), CI, รูปแบบ error + รหัสอ้างอิง, log ที่ console, ลบตัวอย่าง WeatherForecast | Dockerfile ของแอป, compose สำหรับ Production, TLS, SeaweedFS, Mailpit |

## 2. Confirmed Decisions ที่ 1a ใช้

**จากเอกสารเดิม**

- **[ตัดสินแล้ว]** ล็อกอินด้วย ASP.NET Core Identity + Access token (JWT) 15 นาทีในหน่วยความจำ + Refresh token 30 วันในคุกกี้ HttpOnly/Secure/SameSite หมุนทุกครั้ง เก็บค่าแฮชในฐานข้อมูล เพิกถอนได้ ตรวจจับการใช้ใบเก่าซ้ำ ไม่มีช่วงผ่อนผันฝั่งเซิร์ฟเวอร์ ฝั่งหน้าเว็บประสานหลายแท็บให้มีคำขอ Refresh เดียว (ADR 0006)
- **[ตัดสินแล้ว]** ทุก Note เป็นของเจ้าของคนเดียว ตรวจเจ้าของฝั่งเซิร์ฟเวอร์ทุกครั้ง (ADR 0006)
- **[ตัดสินแล้ว]** ยังไม่ยืนยันอีเมลก็จด/จัดวาง/ค้นหา/ใช้ AI ได้ แต่สร้าง Share Link ไม่ได้ เปลี่ยนอีเมลไม่ได้ใน v1 (spec หัวข้อ 11, ticket 014)
- **[ตัดสินแล้ว]** PostgreSQL (ADR 0004) EF Core อยู่ใน `Jod.Service` Web → Service → Domain ห้ามย้อน ใช้ `CustomError` สำหรับข้อผิดพลาดทางธุรกิจ (`backend/CLAUDE.md`)
- **[ตัดสินแล้ว]** ผู้ใช้เห็นข้อความเข้าใจง่ายพร้อมรหัสอ้างอิง log ไม่เก็บเนื้อหา/อีเมล/รหัสผ่าน/โทเคน (spec หัวข้อ 12, ticket 015)
- **[ตัดสินแล้ว]** ความลับอยู่นอก git: dev ใช้ `appsettings.Development.json` (ไม่ commit) Production ใช้ตัวแปรสภาพแวดล้อมหรือระบบจัดการความลับ ผู้ใช้เป็นคนใส่ความลับจริงเอง (CLAUDE.md, ticket 023)
- **[ตัดสินแล้ว]** ธีมมืดเท่านั้น Responsive Web ใช้ได้ทั้งเดสก์ท็อปและมือถือ (ticket 019)
- **[ตัดสินแล้ว]** .NET 10 LTS เป็นเป้าของ backend (ADR 0010)
- **[ตัดสินแล้ว]** การจำกัดผู้สมัครเป็นเงื่อนไขก่อน Production และต้องกำหนดขอบเขต Development/Test ให้ชัด (ผู้ใช้สั่ง 2026-10-20)

**Q1–Q12 (ผู้ใช้ยืนยัน "ตามเสนอ" 2026-10-20)**

| # | การตัดสินใจ |
|---|---|
| Q1 | อัปเกรดเป็น .NET 10 ก่อนเขียนโค้ด (ADR 0010) |
| Q2 | 1a ไม่รวมยืนยันอีเมล/ลืมรหัสผ่าน (เป็น 1c) |
| Q3 | 1a มีหน้าเว็บสมัคร/ล็อกอิน/ออกขั้นต่ำเพื่อตรวจรับกลไกโทเคน |
| Q4 | `AppUser` อยู่ใน `Jod.Service` (ไม่เพิ่มแพ็กเกจ Identity ใน `Jod.Domain`) |
| Q5 | compose มีเฉพาะ Postgres ไม่มี Dockerfile ของแอป |
| Q6 | error เป็น problem+json พร้อม `reference` และ log ไปที่ console (Docker logs) ก่อน |
| Q7 | สมัครสำเร็จเข้าระบบทันที และบอกได้ว่าอีเมลซ้ำที่หน้าสมัคร |
| Q8 | รหัสผ่านขั้นต่ำ 10 ตัวอักษร, ล็อกบัญชี 5 ครั้ง/5 นาที, จำกัดอัตรา 10 คำขอ/นาที/IP, เวลาเหลื่อมของ Access token 30 วินาที |
| Q9 | เทสต์การเชื่อมต่อใช้ PostgreSQL จริง (compose/service container) ไม่ใช้ in-memory และเพิ่มโปรเจกต์เทสต์ใหม่ |
| Q10 | ลบตัวอย่าง WeatherForecast ใน 1a หลังมีโมดูล auth เป็นแบบอย่างแทน (ทั้ง backend และ `modules/weather` ฝั่งหน้าเว็บ) |
| Q11 | เก็บ to-spec เป็นไฟล์ในโฟลเดอร์ `docs/specs/` ก่อน |
| Q12 | ชื่อใหม่ที่ใช้: `IAuthService`, `AuthService`, `RegisterRequestModel`, `LoginRequestModel`, `AuthResultViewModel`, `UserViewModel`, `AppUser`, `RefreshToken`, `JodDbContext`, `AuthController`, `RegistrationMode` (ค่าตั้งค่า) ชื่ออื่นที่เพิ่มระหว่างลงมือต้องขอยืนยันตามกฎใน `backend/CLAUDE.md` |

## 3. Requirements [ร่าง]

- R1 สมัครด้วยอีเมล + รหัสผ่าน (เฉพาะเมื่อเปิดการสมัคร ดูหัวข้อ 8)
- R2 ล็อกอินและออกจากระบบได้ อยู่ในระบบต่อได้โดยไม่ต้องล็อกอินใหม่ภายใน 30 วัน
- R3 ส่วนที่ต้องล็อกอินเข้าไม่ได้ถ้ายังไม่ล็อกอิน
- R4 ข้อความผิดพลาดเป็นภาษาไทยเข้าใจง่ายพร้อมรหัสอ้างอิง
- R5 ใช้ได้บนมือถือและเดสก์ท็อป

## 4. User Flows [ร่าง]

| # | เส้นทาง | ขั้นตอนสำคัญ |
|---|---|---|
| F1 | สมัคร | กรอกอีเมล+รหัสผ่าน → ถ้าปิดการสมัคร เห็น "การสมัครปิดอยู่" → ถ้าเปิดและข้อมูลถูกต้อง เข้าระบบทันที |
| F2 | ล็อกอิน | กรอก → ผิดเห็นข้อความกลาง "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (ไม่บอกว่าอีเมลมีหรือไม่ ไม่บอกว่าถูกล็อก) ผิดหลายครั้งถูกล็อกชั่วคราว |
| F3 | เปิดหน้าใหม่หรือรีเฟรช | หน้าเว็บขอ Access token ใหม่เงียบๆ ด้วยคุกกี้ ถ้าไม่ได้ → ไปหน้าล็อกอิน |
| F4 | Access token หมดอายุกลางการใช้งาน | ต่ออายุเงียบๆ แล้วลองคำขอเดิมซ้ำ 1 ครั้ง ถ้าต่ออายุไม่ได้ → หน้าล็อกอิน |
| F5 | เปิดหลายแท็บ | ใช้ Web Locks ให้มีคำขอต่ออายุเดียวต่อรอบ แท็บอื่นรอแล้วใช้ผลร่วมกัน |
| F6 | ออกจากระบบ | เพิกถอน Refresh token ชุดนั้น ลบคุกกี้ กลับหน้าล็อกอิน |
| F7 | พบการใช้ Refresh token ใบเก่าซ้ำ | เพิกถอนทั้งชุด ผู้ใช้ถูกบังคับล็อกอินใหม่ |
| F8 | ข้อผิดพลาดของระบบ | เห็นข้อความทั่วไป + รหัสอ้างอิง ไม่เห็นรายละเอียดภายใน |

## 5. Business Rules

**[ตัดสินแล้ว] (Q8, Q7, ADR 0006)**

- รหัสผ่านอย่างน้อย 10 ตัวอักษร ไม่บังคับรูปแบบผสม
- ล็อกอินผิด 5 ครั้ง → ล็อกบัญชี 5 นาที (ใช้ตัวล็อกของ Identity ค่าเป็นค่าตั้งค่า)
- จำกัดอัตรา register/login/refresh ที่ 10 คำขอ/นาที/IP (ค่าเป็นค่าตั้งค่า)
- สมัครสำเร็จ = เข้าระบบทันที (ได้ Access token + คุกกี้) สมัครด้วยอีเมลที่มีอยู่แล้วตอบว่า "อีเมลนี้มีบัญชีแล้ว" ส่วนหน้าล็อกอินไม่บอกว่าอีเมลมีบัญชีหรือไม่
- Access token อายุ 15 นาที Refresh token อายุ 30 วัน หมุนทุกครั้ง ใช้ใบเก่าซ้ำ = เพิกถอนทั้งชุด ไม่มีช่วงผ่อนผันฝั่งเซิร์ฟเวอร์ เวลาเหลื่อมที่ยอมของ Access token 30 วินาที

**[ร่าง]**

- อีเมลเทียบแบบไม่สนตัวพิมพ์เล็กใหญ่และตัดช่องว่างหัวท้าย ยาวไม่เกิน 254 ตัวอักษร รหัสผ่านยาวไม่เกิน 128 ตัวอักษร
- ออกจากระบบทำให้ Access token ที่ออกไปแล้วยังใช้ได้จนหมดอายุ (≤15 นาที) เป็นข้อจำกัดของ JWT ไม่ใช่บั๊ก
- Access token มี claims: `sub` (รหัสผู้ใช้) `jti` `iat` `exp` `iss` `aud` ไม่ใส่อีเมล เซ็นแบบ HS256 ด้วยกุญแจลับความยาวอย่างน้อย 32 ไบต์จากการตั้งค่า
- ออกจากระบบเพิกถอนเฉพาะ "ชุด" ของอุปกรณ์นั้น

## 6. Core Concepts

ศัพท์ในเอกสารนี้ (บัญชี, Access token, Refresh token, ชุด Refresh token) เป็นศัพท์เทคนิคของสถาปัตยกรรม อยู่ใน ADR 0006 แล้ว ไม่ใช่ศัพท์ของ Product จึงไม่เพิ่มใน `CONTEXT.md`

## 7. Data Model ระดับที่จำเป็น [ร่าง]

| ตาราง | ฟิลด์สำคัญ | หมายเหตุ |
|---|---|---|
| ผู้ใช้ (Identity, `AppUser`) | รหัส (Guid), อีเมล, อีเมลแบบ normalize, ค่าแฮชรหัสผ่าน, ยืนยันอีเมลแล้วหรือยัง (เป็นเท็จเสมอใน 1a), ตัวล็อกบัญชี, วันที่สร้าง | ตารางมาตรฐานของ Identity ชื่อผู้ใช้ = อีเมล เวลาเก็บเป็น UTC |
| Refresh token (`RefreshToken`) | รหัส, รหัสผู้ใช้, รหัสชุด (family), ค่าแฮช SHA-256 ของโทเคนสุ่ม 256 บิต, สร้างเมื่อ, หมดอายุเมื่อ, ถูกใช้แล้วเมื่อ, เพิกถอนเมื่อ, ถูกแทนที่โดย | ไม่เก็บโทเคนจริง |

- กติกาการใช้ Refresh token ต้องเป็นขั้นตอนเดียวในฐานข้อมูล: อัปเดตแบบมีเงื่อนไข "ยังไม่ถูกใช้" แล้วดูว่ากระทบ 1 แถวหรือไม่ ถ้าไม่ (ถูกใช้ไปแล้ว) ถือว่าใช้ซ้ำ → เพิกถอนทั้งชุด ผลคือ คำขอต่ออายุพร้อมกันสองคำขอด้วยโทเคนใบเดียวกัน หนึ่งสำเร็จ อีกหนึ่ง 401 และทั้งชุดถูกเพิกถอน (ตาม ADR 0006 ไม่มีช่วงผ่อนผัน การประสานหลายแท็บฝั่งหน้าเว็บจึงสำคัญ)
- ยังไม่มีงานล้างโทเคนหมดอายุ (เลื่อนไปก่อน Production)
- ตาราง Note ยังไม่สร้างใน 1a ความเป็นเจ้าของของ Note ใช้ `OwnerId` (Guid) ใน 1b
- การสร้าง/แก้ schema ในงานนี้ทำได้เพราะ to-spec นี้เป็นคำขอที่ชัดเจนตามกฎใน `backend/CLAUDE.md` migration ใช้ EF Core เก็บใน `Jod.Service`

## 8. การควบคุมการสมัคร

**[ตัดสินแล้ว]** การจำกัดผู้สมัครใน Production เป็นเงื่อนไขก่อน Production (OQ-10) และต้องกำหนดขอบเขต Development/Test ให้ชัด

**[ร่าง] วิธีทำให้ไม่เปิดสาธารณะโดยไม่ตั้งใจ**

- ค่าตั้งค่า `Registration:Mode` มี 2 ค่า: `Closed` (ค่าเริ่มต้นเมื่อไม่ตั้ง) และ `Open`
- `Open` ใช้ได้เฉพาะ `ASPNETCORE_ENVIRONMENT` เป็น `Development` หรือ `Test` ถ้าตั้ง `Open` ในสภาพแวดล้อมอื่น แอปไม่เริ่มทำงานพร้อมข้อความชัดเจน
- ปิดอยู่ = `POST /api/auth/register` ตอบ 403
- compose ผูกพอร์ตกับ `127.0.0.1` เท่านั้น และไม่มี compose/Dockerfile สำหรับ Production ใน 1a
- เทสต์อัตโนมัติ: ค่าเริ่มต้น = ปิด, `Open` นอก Dev/Test = เริ่มไม่ได้
- ยังไม่มีวิธีสร้างบัญชีตอนปิดการสมัคร (OQ-10) ใน 1a ใช้ Development/Test เท่านั้น

## 9. API Contract [ร่าง]

ทุก endpoint อยู่ใต้ `/api` ตอบ JSON คุกกี้ Refresh ชื่อ `jod_refresh` (HttpOnly, SameSite=Strict, Path=`/api/auth`, อายุ 30 วัน, Secure ในทุกสภาพแวดล้อมที่ไม่ใช่ Development ส่วน Development ใช้ Secure ตามโปรโตคอลของคำขอ **[ยังไม่ได้ตรวจ]** ว่าเบราว์เซอร์ทุกตัวรับคุกกี้ Secure บน `http://localhost`)

| Endpoint | เข้าได้ | คำขอ | ผลสำเร็จ | ข้อผิดพลาดหลัก |
|---|---|---|---|---|
| `POST /api/auth/register` | ไม่ต้องล็อกอิน | `{ email, password }` | 201 `{ accessToken, expiresInSeconds, user:{id,email,emailConfirmed} }` + คุกกี้ | 400 ข้อมูลไม่ถูกต้อง, 403 ปิดการสมัคร, 409 อีเมลซ้ำ |
| `POST /api/auth/login` | ไม่ต้องล็อกอิน | `{ email, password }` | 200 รูปแบบเดียวกับ register + คุกกี้ | 401 ข้อความกลาง (รวมกรณีถูกล็อกชั่วคราว), 400 |
| `POST /api/auth/refresh` | ใช้คุกกี้ | ไม่มี body + หัวข้อ `X-Requested-With: jod` | 200 `{ accessToken, expiresInSeconds }` + คุกกี้ใหม่ | 401 ไม่มี/หมดอายุ/เพิกถอน/ใช้ซ้ำ (ใช้ซ้ำเพิกถอนทั้งชุด), 403 ไม่มีหัวข้อ |
| `POST /api/auth/logout` | ใช้คุกกี้ | หัวข้อเดียวกับ refresh | 204 + ลบคุกกี้ | 403 ไม่มีหัวข้อ (ไม่มีคุกกี้ก็ 204 ซ้ำได้) |
| `GET /api/me` | ต้องล็อกอิน | – | 200 `{ id, email, emailConfirmed }` | 401 |

- **รูปแบบ error ทุก endpoint:** `application/problem+json` มี `status`, `title`, `detail` (ข้อความไทยที่ผู้ใช้เห็นได้), `reference` (รหัสสั้นสุ่ม 8 ตัวอักษร ใช้ค้นใน log), `errors` (รายการข้อความเมื่อเป็นข้อผิดพลาดตรวจสอบข้อมูล จาก `CustomError` เดิม) ไม่มี stack trace หรือชื่อภายใน
- header ความปลอดภัยพื้นฐาน (`X-Content-Type-Options: nosniff` ฯลฯ) ไม่เปิด CORS (หน้าเว็บกับ API แหล่งเดียวกัน)
- ลักษณะ JSON ชื่อฟิลด์เป็น camelCase

## 10. Architecture ของ 1a (ใช้โครงเดิม Web → Service → Domain)

- **Web.Jod [ร่าง]:** `AuthController`, ตั้งค่า JWT bearer + นโยบายต้องล็อกอินเป็นค่าเริ่มต้น (`[AllowAnonymous]` เฉพาะ endpoint ที่ระบุ), ตัวจัดการข้อผิดพลาดที่สร้าง `reference`, การจำกัดอัตรา, ตรวจโหมดการสมัครตอนเริ่มแอป
- **Jod.Service [ร่าง]:** `JodDbContext` (Identity + Refresh token), `AuthService` (ออก/หมุน/เพิกถอนโทเคน, ตรวจกติกา), การตั้งค่าแบบ Options, migrations, `AppUser`
- **Jod.Domain [ร่าง]:** `IAuthService`, `RegisterRequestModel`, `LoginRequestModel`, `AuthResultViewModel`, `UserViewModel`, `CustomError` เดิม
- **แพ็กเกจที่เสนอ [ยังไม่ได้ตรวจความเข้ากันได้กับ .NET 10]:** `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `Npgsql.EntityFrameworkCore.PostgreSQL`, `Microsoft.EntityFrameworkCore.Design`, ฝั่งเทสต์ `Microsoft.AspNetCore.Mvc.Testing` และเครื่องมือ `dotnet-ef` แบบ local tool
- **ฝั่งหน้าเว็บ [ร่าง]:** `modules/auth/` (components, hooks, services, types, utils) ตามโครงของ `modules/weather`, ขยาย `core/http` ให้แนบ Access token และต่ออายุเมื่อเจอ 401 พร้อม Web Locks + BroadcastChannel, ตัวป้องกันเส้นทางใน `core/router`, `AuthProvider` ใน `core/providers` ตรรกะที่ทดสอบได้ใส่ใน `utils/` เป็น `*.test.ts` (ไม่เพิ่ม jsdom ใน 1a)
- **ธีม [ร่าง]:** ใช้ค่าสีมืดของ prototype 017 เป็นตั้งต้น (`#191919` พื้น, `#202020` แถบข้าง, ตัวอักษรขาว 90%, สีเน้น `#6cb3f5`) นิยามเป็น CSS custom properties ตามกฎใน `client/CLAUDE.md` ถือ `DESIGN.md` (วิเคราะห์ Notion ธีมสว่าง) เป็นเอกสารอ้างอิงเท่านั้น ไม่ใช่ชุดสีของ Jod

## 11. Docker Compose และ CI [ร่าง]

- **`docker-compose.yml` (ราก):** บริการเดียวคือ `postgres` (เสนอ `postgres:16` ซึ่งเคยทดสอบใน PoC) volume ชื่อ, `healthcheck` ด้วย `pg_isready`, พอร์ต `127.0.0.1:5432`, ค่ารหัสผ่านจาก `.env` ที่ไม่ commit และมี `.env.example` ระดับรากเป็นค่าสมมติ ฐานข้อมูลทดสอบแยกจากฐานข้อมูลพัฒนา
- **CI (GitHub Actions, `.github/workflows/ci.yml`):** ทำงานเมื่อมี PR ไปที่ `dev`/`main` และ push เข้า `dev` งาน backend: restore, build, `dotnet format --verify-no-changes`, test โดยมี PostgreSQL เป็น service container งาน client: `npm ci`, `lint`, `build` (รวม `tsc`), `test` และตรวจ `docker compose config`
- การบังคับให้ CI ผ่านก่อน merge ต้องตั้งในหน้า Settings ของ GitHub โดยผู้ใช้ (ไม่ใช่ไฟล์ใน repo) **[ยังไม่ได้ตรวจ]** ว่า repo เป็นแบบ private หรือไม่ และมีโควตา Actions พอ

## 12. Acceptance Criteria [ร่าง]

1. สมัครสำเร็จ (โหมด Open ใน Dev/Test) ได้ 201 + Access token + คุกกี้ และมีแถวผู้ใช้ รหัสผ่านถูกเก็บเป็นแฮช ไม่มีรหัสผ่านจริงในฐานข้อมูลหรือ log
2. อีเมลซ้ำ (ต่างตัวพิมพ์ มีช่องว่างหัวท้าย) ได้ 409 / รหัสผ่านสั้นกว่า 10 ได้ 400 พร้อมข้อความไทยและ `reference`
3. ล็อกอินถูกได้ 200 ผิดได้ 401 ข้อความกลาง ผิดครบ 5 ครั้งแล้วถูกล็อก 5 นาที (ตอบ 401 เหมือนเดิม)
4. `GET /api/me`: ไม่มีโทเคน, หมดอายุ, ลายเซ็นผิด → 401, โทเคนถูกต้อง → 200 และ endpoint ใหม่ใดๆ ที่ไม่ใส่ `[AllowAnonymous]` ถูกบังคับล็อกอินโดยอัตโนมัติ (มีเทสต์)
5. Refresh: ได้ Access token ใหม่ + คุกกี้ใหม่, ใบเก่าใช้ซ้ำ → 401 และทั้งชุดถูกเพิกถอน, คำขอ Refresh พร้อมกัน 2 คำขอด้วยใบเดียวกัน → หนึ่งสำเร็จ อีกหนึ่ง 401 และชุดถูกเพิกถอน, ครบ 30 วัน → 401
6. ออกจากระบบ: Refresh หลังออกใช้ไม่ได้ คุกกี้ถูกลบ
7. คุกกี้ถูกต้องตามสเปค (HttpOnly, SameSite=Strict, Path, Secure นอก Development) และ Refresh/Logout ที่ไม่มี `X-Requested-With` ถูกปฏิเสธ
8. การสมัคร: ค่าเริ่มต้น = ปิด (403) / ตั้ง `Open` นอก Dev/Test → แอปไม่เริ่ม (มีเทสต์ทั้งสองข้อ)
9. ทุกคำตอบผิดพลาดเป็น problem+json มี `reference` ข้อผิดพลาด 500 ไม่รั่ว stack trace และ log มีรหัสอ้างอิง+ชนิดข้อผิดพลาด **ไม่มี** อีเมล รหัสผ่าน โทเคน หรือเนื้อหาคำขอ (ทดสอบด้วยการดักล็อก)
10. `docker compose up` ได้ Postgres ที่พร้อมใช้ migration สร้างตารางครบจากฐานข้อมูลว่าง สั่งซ้ำได้โดยไม่พัง
11. แอปไม่เริ่มถ้า `Jwt:SigningKey` หาย ยังเป็นค่าสมมติ หรือสั้นกว่า 32 ไบต์ และไม่มีค่าลับใน git (ไฟล์ตัวอย่างเป็นค่าสมมติเท่านั้น)
12. หน้าเว็บ: สมัคร/ล็อกอิน/ออก ใช้ได้บนเดสก์ท็อปและความกว้าง 375px ฟอร์มมีสถานะ hover/focus/active/disabled คอนทราสต์ผ่าน WCAG AA ใช้แป้นพิมพ์ได้ ข้อความไทย
13. Access token อยู่ในหน่วยความจำเท่านั้น (ไม่อยู่ใน localStorage/sessionStorage) รีเฟรชหน้าแล้วยังอยู่ในระบบ เปิด 2–3 แท็บพร้อมกันได้ โดยมีคำขอ Refresh ไม่เกิน 1 ต่อรอบ และไม่ถูกบังคับออกจากระบบผิดพลาด (ทดสอบตรรกะอัตโนมัติ + ทดสอบด้วยมือหลายแท็บ)
14. เจอ 401 กลางการใช้งาน: หน้าเว็บ Refresh แล้วลองคำขอเดิมซ้ำ 1 ครั้งไม่เป็นลูป ถ้า Refresh ล้มเหลว → หน้าล็อกอิน
15. CI รัน build/format/test/lint ของทั้งสองฝั่งและผ่าน ทำให้ล้มเมื่อ format ผิด Definition of Done ใน `CLAUDE.md` ผ่าน (build, test, format ใน CI, ไม่มีไฟล์ที่ไม่จำเป็น)
16. ไม่มีตารางหรือหน้าจอของ Note (ไม่ขยายไป 1b) ตัวอย่าง WeatherForecast ถูกลบและเอกสารคำแนะนำ (`backend/CLAUDE.md`, `client/CLAUDE.md`) ตรงกับโค้ดจริง

## 13. Dependency และสิ่งที่เลื่อน

- **Dependency:** ADR 0004, 0006, 0010 · Docker Desktop · .NET SDK 10 · Node · GitHub Actions · ผู้ใช้ใส่กุญแจเซ็น Access token จริงเอง
- **เลื่อนไป 1b:** Note, Block schema ขั้นต่ำ, Autosave, ตรวจชนด้วยเลขเวอร์ชัน, Editor + layout มือถือ, ชุดสีที่ใช้จริงทั้งแอป
- **เลื่อนไป 1c:** ยืนยันอีเมล/ลืมรหัสผ่าน (ต้องมี `IEmailService`, Mailpit, ขั้นตอนผู้ดูแลตาม ADR 0007 และเกี่ยวกับ OQ-6)
- **เลื่อนไปก่อน Production:** Dockerfile และ compose สำหรับ Production, วิธีจำกัดผู้สมัคร (OQ-10), งานล้างโทเคน, เปลี่ยนรหัสผ่าน/ออกทุกอุปกรณ์

## 14. Open Questions และสิ่งที่ต้องตรวจตอนลงมือ

- **OQ-10 (ใหม่)** วิธีจำกัดผู้สมัครใน Production และวิธีสร้างบัญชีแรกตอนปิดการสมัคร (`docs/open-questions.md`) ไม่ขวาง 1a
- Swashbuckle.AspNetCore 6.6.2 และแพ็กเกจอื่นกับ .NET 10 (ADR 0010) ต้องตรวจก่อนเปลี่ยน `.csproj`
- Secure cookie บน `http://localhost` ในเบราว์เซอร์ที่ใช้จริง
- ชื่อ/ชนิดใหม่นอกเหนือรายการ Q12 ต้องขอยืนยันก่อนตั้ง

## 15. รายการไฟล์ที่จะสร้างหรือแก้ใน PR ของ 1a (ชื่อตาม Q12 ต้องยืนยัน)

**Backend:** แก้ `Web.Jod/Program.cs`, ทุก `.csproj` (เป็น `net10.0` และเพิ่มแพ็กเกจ), `appsettings.json` (ค่าที่ไม่ลับ: Issuer/Audience/อายุโทเคน/โหมดสมัคร=Closed), `appsettings.Development.example.json` (ใส่ตำแหน่งกุญแจเซ็นและ connection string แบบสมมติ) · สร้าง `Controllers/AuthController.cs`, ตัวจัดการข้อผิดพลาดใน `Middleware/`, `Jod.Domain/{Interfaces,RequestModels,ViewModels}/…`, `Jod.Service/{Data/JodDbContext.cs, ImplementServices/AuthService.cs, Options/…, Migrations/…}`, `.config/dotnet-tools.json`, เทสต์ใน `Jod.Service.Tests/` และโปรเจกต์เทสต์การเชื่อมต่อใหม่ · ลบตัวอย่าง WeatherForecast (controller, service, interface, view model, เทสต์)

**Client:** แก้ `core/http/http-client.ts`, `main.tsx`/`App.tsx`, `vite.config.ts` (ถ้าจำเป็น) · สร้าง `modules/auth/**`, `core/router/…`, `core/providers/AuthProvider.tsx`, เทสต์ `*.test.ts`, CSS custom properties ของธีมมืด · ลบ `modules/weather`

**ราก/โครงระบบ:** `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, `README.md` (วิธีรัน), `.gitignore`/`.dockerignore` ตามจำเป็น

**เอกสาร (ใน PR เดียวกับโค้ด):** `backend/CLAUDE.md` (บรรทัดเรื่อง `net8.0` ที่ยังเหลือ, "No database/ORM yet", หัวข้อ Database / EF Core Rules, ตัวอย่าง WeatherForecast ใน Project Structure) และ `client/CLAUDE.md` (ตัวอย่าง `modules/weather`) ให้ตรงกับโค้ดจริง

## 16. สิ่งที่ยังไม่ได้ตรวจ/ทดสอบ

คุกกี้ Secure บน `http://localhost` ในแต่ละเบราว์เซอร์ · ความเข้ากันได้ของแพ็กเกจกับ .NET 10 (Swashbuckle, Npgsql, Identity) · ความเร็วของแฮชรหัสผ่านและต้นทุนการหมุนโทเคนต่อคำขอ · โควตา GitHub Actions · ตรรกะประสานหลายแท็บด้วย Web Locks ในทางปฏิบัติ · IME ภาษาไทยบนมือถือในฟอร์ม (เป็นเกณฑ์ตรวจรับของ Editor ใน 1b)
