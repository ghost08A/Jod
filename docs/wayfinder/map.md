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
- Skills ที่ทุก session ควรเรียก: `grilling`, `domain-modeling` (คำศัพท์ที่ยืนยันแล้วลง `GLOSSARY.md` ที่ราก)
- Ticket types: `grilling` / `research` / `prototype` / `task` (ทุก ticket ตอนนี้เป็น `grilling` = HITL)

## Decisions so far

<!-- ว่าง: ยังไม่มี ticket ที่ปิด -->

## Frontier / Tickets

| # | Ticket | Type | Blocked by |
|---|---|---|---|
| 001 | [Core concepts](tickets/001-core-concepts.md) | grilling | - |
| 003 | [Hierarchy & move rules](tickets/003-hierarchy-move-rules.md) | grilling | - |
| 002 | [Capture & unplaced notes](tickets/002-capture-unplaced-notes.md) | grilling | 001 |
| 004 | [Trash rules](tickets/004-trash-rules.md) | grilling | 003 |
| 005 | [Reference stability & merge](tickets/005-reference-stability-merge.md) | grilling | 001, 003 |
| 006 | [Editor content model](tickets/006-editor-content-model.md) | grilling | 001 |
| 007 | [Autosave & conflict behavior](tickets/007-autosave-conflict.md) | grilling | 001 |
| 008 | [AI placement suggestion lifecycle](tickets/008-ai-placement-lifecycle.md) | grilling | 002, 003 |
| 009 | [Share link (read-only) rules](tickets/009-share-link-rules.md) | grilling | 003, 005 |

## Not yet specified

- **Search §6:** "ค้นหาตาม Topic / Hierarchy" หมายถึงอะไร (ขึ้นกับ 001 และ 003)
- **Note Context §13 และ AI privacy:** Context ถูกส่งออกให้ AI ภายนอกหรือไม่ มีขอบเขตอย่างไร (ขึ้นกับ 008)
- **AI Markdown Formatting §14:** กฎ "รักษาโครงสร้างเดิม" ที่ตรวจได้ (ขึ้นกับ 006)
- **Attachments §15:** ความเป็นเจ้าของไฟล์, ชีวิตของไฟล์เมื่อ Note ถูกลบ/Merge (ขึ้นกับ 004, 005)
- **Email Verification §11:** สถานะ "ยังไม่ยืนยัน" จำกัดอะไรได้บ้าง (ขึ้นกับ Account ที่ยังไม่มี ticket)
- **Error Logging §10:** ระดับ requirement ว่า Error ที่ผู้ใช้เห็นกับที่ระบบเก็บต่างกันอย่างไร (ไม่ดึงเข้า Architecture)
- **User Flow รวม:** ร้อยเป็น Flow หลักจากกฎที่ตัดสินแล้ว (จดโน้ต → จัดวาง → ค้นหา → ลบ/กู้ → แชร์)

## Out of scope

<!-- ว่าง -->
