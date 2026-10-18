---
status: accepted
---
# ใช้ TipTap เป็นฐานของ Editor และเมนู /

Editor แบบ Block และเมนู `/` สร้างบน TipTap ตรวจเมื่อ 2026-10-18 ว่าแพ็กเกจที่ต้องใช้ ได้แก่ `@tiptap/starter-kit` (ย่อหน้า หัวข้อ รายการ อ้างอิง โค้ด เส้นแบ่ง ลิงก์), `@tiptap/extension-task-list`, `@tiptap/extension-details`, `@tiptap/extension-image` และ `@tiptap/suggestion` เป็นใบอนุญาต MIT บน npm สาธารณะ ไม่ต้องใช้ registry แบบเสียเงิน Callout, Reference Card และ Block ไฟล์ ไม่มีสำเร็จรูป ต้องเขียนเป็น node ของเราเอง ส่วนเสริมแบบเสียเงินของ TipTap (เช่น comments, AI) ไม่ใช้

## Consequences

- ย้ายออกจาก TipTap ทีหลังต้องย้ายเนื้อหา Block ทั้งหมด จึงถือเป็นข้อผูกมัดระดับ Editor
- กฎ Protected Block, หน้าตรวจผล AI รายรายการ และเกณฑ์ตรวจรับ Nested Blocks/มือถือ (ticket 022) ต้องทดสอบบน Editor จริง
- ไม่ได้อนุมานรูปแบบการเก็บข้อมูลของ Block จากการตัดสินใจนี้ (ตัดสินใน ticket Architecture decisions 023)
