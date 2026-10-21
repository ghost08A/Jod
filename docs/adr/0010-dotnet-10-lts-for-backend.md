---
status: accepted
---
# ใช้ .NET 10 (LTS) เป็นเป้าของ backend แทน .NET 8

ตัดสินเมื่อ 2026-10-20 .NET 8 หมดซัพพอร์ตวันที่ 2026-11-10 ส่วน .NET 9 (STS) หมดวันเดียวกัน แต่ .NET 10 เป็น LTS ซัพพอร์ตถึง 2028-11-14 (ตามหน้านโยบาย .NET ของ Microsoft ที่ตรวจเมื่อ 2026-10-20) โปรเจกต์ยังไม่มีโค้ดจริง (มีแต่โค้ดตัวอย่างเริ่มต้นของเทมเพลต) ต้นทุนการอัปเกรดต่ำสุดตอนนี้ ADR นี้แทนข้อความ ".NET 8 (หลังบ้านตามฐานที่มี)" ใน product-spec หัวข้อ 15

## Considered Options

- อยู่ที่ .NET 8: ไม่ต้องแก้อะไร แต่ซัพพอร์ตหมดในราว 3 สัปดาห์ และต้องอัปเกรดทีหลังโดยมีโค้ดจริงค้ำอยู่
- .NET 9: เป็น STS หมดซัพพอร์ตวันเดียวกับ .NET 8 จึงไม่เหมาะ

## Consequences

- ทุก `.csproj` เปลี่ยนเป็น `net10.0` ในงาน 1a แพ็กเกจหลักของ Microsoft (EF Core, Identity, JwtBearer) ใช้รุ่นหลัก 10 CI และ image ฐานของ Docker ใช้ .NET 10
- `backend/CLAUDE.md` ระบุเป็นข้อความชั่วคราวจนกว่า `.csproj` จะเปลี่ยนจริง
- แพ็กเกจของ `Jod.Service` ตอนนี้: `Microsoft.EntityFrameworkCore` 10.0.13 (ปักรุ่นเอง เพราะ Npgsql provider 10.0.3 ดึงรุ่น 10.0.4 มาชนกับรุ่นของ `Microsoft.EntityFrameworkCore.Design` 10.0.13 ที่ Web.Jod ใช้), `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, `Microsoft.IdentityModel.JsonWebTokens` 8.23.0 และ `Google.Apis.Auth` 1.77.0 (ตรวจ Google ID token ตาม ADR 0006 ดึง `Google.Apis`, `Google.Apis.Core`, `Newtonsoft.Json` 13.0.4 มาด้วย) ไม่มี ASP.NET Core Identity แล้ว

## เงื่อนไขก่อนลงมือ (ต้องตรวจก่อนเปลี่ยน `.csproj`)

- Swashbuckle.AspNetCore 6.6.2 ใช้กับ .NET 10 ได้หรือไม่ ถ้าไม่ได้ ให้อัปเดตรุ่นหรือเปลี่ยนไปใช้ตัวสร้างเอกสาร OpenAPI ที่มากับเฟรมเวิร์ก
- ความเข้ากันได้ของ Npgsql EF provider รุ่นหลัก 10 กับ PostgreSQL 16, ชุดเทสต์ (xunit, Moq, coverlet) ที่ pin รุ่นเดิมไว้

## ผลตรวจจริง (2026-10-20, SDK 10.0.401, งาน 1a-1)

- ทุกโปรเจกต์ใน solution เป็น `net10.0` build ผ่าน 0 warning เทสต์เดิม 3 ข้อผ่าน `dotnet format --verify-no-changes` ผ่าน
- Swashbuckle.AspNetCore 6.6.2 ใช้กับ .NET 10 ได้: เปิดแอปในโหมด Development แล้ว `/swagger/index.html` และ `/swagger/v1/swagger.json` ตอบ 200 (ยังไม่ได้ทดสอบทุกฟีเจอร์ของ Swashbuckle ที่ซับซ้อนกว่า controller ตัวอย่าง)
- xunit 2.5.3, Moq 4.21.0, coverlet 6.0.0, Microsoft.NET.Test.Sdk 17.8.0 (รุ่นเดิม) รันบน net10.0 ได้ ไม่ต้องอัปเดตเพื่อให้เทสต์ผ่าน

## [ยังไม่ได้ทดสอบ]

- ความเข้ากันได้ของ Npgsql EF provider รุ่นหลัก 10 กับ PostgreSQL 16: เทสต์เชื่อมต่อ 79 ข้อผ่านกับ PostgreSQL 16 จริงแล้วเมื่อ 2026-10-21 แต่ยังไม่ได้ตรวจกรณีละเอียดอื่น
- `Google.Apis.Auth` 1.77.0 บน .NET 10: build ผ่านและปฏิเสธ token ผิดรูปแบบ/ลายเซ็นปลอมตามคาด ยังไม่ได้ตรวจกับ token ที่ Google เซ็นจริง
- AWSSDK.S3 บน .NET 10 (PoC ของ SeaweedFS ทดสอบบน .NET 8 ผลยังใช้เป็นหลักฐานของที่เก็บไฟล์ แต่ต้องทดสอบ SDK ซ้ำบน .NET 10 ตอนทำฟีเจอร์ไฟล์)
