# Map: Jod Product Design

## Destination

Product Design ที่ Requirements, User Flow, Business Rules และ Core Concepts ชัดเจนพอที่จะนำไปออกแบบ Architecture ต่อ (ยังไม่ลง DB / API / Code)

## Notes

- Tracker: Local Markdown ใน `docs/wayfinder/` (`tickets/NNN-slug.md`) ส่วน GitHub Issues ใช้เมื่อเข้า to-spec และงาน implementation
- ที่มา requirement: `requirement.md` (ราก) แต่ละหัวข้ออ้างด้วยเลข `§N`
- กฎของ effort นี้: ข้อเสนอของ agent **ไม่ใช่** Requirement หรือ Decision จนกว่าผู้ใช้ยืนยัน ตัวเลือกใน ticket ทั้งหมดเป็น "Proposed (unconfirmed)"
- User-confirmed framing:
  - Jod เป็นแอปแบบเจ้าของคนเดียว (ไม่มีการแก้ไขร่วมกัน)
  - Share = ให้คนอื่น**ดู** Note ได้อย่างเดียว ไม่แก้ไข
  - Scope: ครอบ §1–§16 ให้มากที่สุด หัวข้อที่ยังไม่คมให้เป็น Not yet specified
- Skills ที่ทุก session ควรเรียก: `grilling`, `domain-modeling` (คำศัพท์ที่ยืนยันแล้วลง `CONTEXT.md` ที่ราก)
- Ticket types: `grilling` / `research` / `prototype` / `task` (ทุก ticket เป็น `grilling` = HITL)

## Decisions so far

- [Core concepts](tickets/001-core-concepts.md): Topic ตัดทิ้ง; Link=URL นอก, Reference Card=Block ชี้ Note; Unplaced note=Note ไม่มี Parent ที่ไม่ใช่ Root note; นิยามเต็มใน `CONTEXT.md`
- [Hierarchy & move rules](tickets/003-hierarchy-move-rules.md): ย้ายทั้งกิ่ง, ห้ามย้ายเข้าลูกหลานตัวเอง, ลำดับ Child ผู้ใช้จัดเอง, มี Root note แยกจาก Unplaced note
- [Capture & unplaced notes](tickets/002-capture-unplaced-notes.md): New note ปุ่มเดียว + Save เลือก AI/Root note/Unplaced; /Note ไม่มี Save; Autosave; Note ว่างลบถาวร
- [Reference stability & merge](tickets/005-reference-stability-merge.md): การ์ดชี้ตัวตน Note; Merge A เข้า B ผู้ใช้เลือก, ต่อเนื้อหา, Child ตามไป, ใช้ Title/Context ของ B, ย้อนไม่ได้, Alias ต่อทอดได้
- [Trash rules](tickets/004-trash-rules.md): ลบทั้งกิ่งหรือเฉพาะ Note, กู้ทั้งกิ่ง/กู้ลูกเดี่ยว→Unplaced, ลบถาวรผู้ใช้สั่งเอง, การ์ดแสดง "ถูกลบ", Trash ดูอย่างเดียว
- [AI placement suggestion lifecycle](tickets/008-ai-placement-lifecycle.md): AI ทำเมื่อผู้ใช้สั่ง, เสนอตัวเดียวจาก Note ที่มีอยู่, ยืนยัน=ย้ายทันที, ปฏิเสธแล้วไม่เสนอซ้ำ, ไม่หมดอายุ
- [Editor content model](tickets/006-editor-content-model.md): Block คือหน่วยจริง Markdown แค่นำเข้า/ส่งออก; ซ้อนได้ไม่จำกัด; มี Block ไฟล์
- [Autosave & conflict behavior](tickets/007-autosave-conflict.md): หยุดพิมพ์ ~1 วิ/ออกจากหน้า; แสดงสถานะ; ชนกัน→เลือกฉบับหรือเก็บทั้งสอง
- [Search scope](tickets/010-search-scope.md): Filter Parent รวมทั้งกิ่ง; ไม่รวม Trash; ไม่ค้น Context
- [Attachments](tickets/011-attachments.md): ไฟล์เป็น Block ใน Note ตามไปกับ Note
- [AI data boundary](tickets/012-ai-data-boundary.md): ส่ง Note ที่วิเคราะห์ + Title/Context ของที่วางได้; แจ้งครั้งแรก
- [Share link rules](tickets/009-share-link-rules.md): แชร์ทั้งกิ่งดูอย่างเดียว; การ์ดในกิ่งที่แชร์เปิด Note ปลายทางพร้อมลูกหลานได้; เลือกจำกัด email/ใครก็ได้; เพิกถอน+วันหมดอายุ; Merge แล้ว Link ใช้ไม่ได้
- [AI Markdown formatting](tickets/013-ai-markdown-formatting.md): AI จัดโครงสร้าง/เรียบเรียง/เพิ่มเนื้อหาได้; ห้ามแตะการ์ด/ไฟล์/Code/Link; ผู้ใช้เทียบแล้วยืนยัน
- [Email verification & account](tickets/014-email-verification-account.md): ยังไม่ยืนยันห้ามสร้าง Share Link; ผู้รับต้องยืนยัน; เปลี่ยน email ไม่ได้ v1
- [Error logging](tickets/015-error-logging.md): ผู้ใช้เห็นข้อความ+รหัสอ้างอิง; log ไม่เก็บเนื้อหา/email; AI ล้ม Note ไม่เสีย
- [Main user flows](tickets/016-main-user-flows.md): [flows.md](flows.md) ยืนยันแล้ว; ของใหม่เข้ากิ่งที่แชร์ถูกแชร์อัตโนมัติ+เตือน

สรุปรวมทุกการตัดสินใจ: [docs/product-spec.md](../product-spec.md)

## Frontier / Tickets

ไม่มี ticket เหลือ: ถึง Destination แล้ว


## Not yet specified

<!-- ว่าง: ไม่มีหมอกเหลือ -->


## Out of scope

<!-- ว่าง -->
