# Jod

แอปจดโน้ตแบบ "จดก่อน จัดทีหลัง" Note ซ้อนกันเป็น Tree ได้ และ AI ช่วยแนะนำที่วาง

## Language

**Note**:
หน่วยหลักของ Jod มี Title, Block หลายอัน และ Context ของตัวเอง
_Avoid_: Page, Document

**Block**:
ชิ้นส่วนเนื้อหาข้างใน Note (ย่อหน้า, Checklist, Link, Reference Card ฯลฯ) ไม่ใช่ Note
_Avoid_: Section

**Link**:
Block ที่เก็บที่อยู่เว็บภายนอก (URL)
_Avoid_: Reference

**Reference Card**:
Block ที่ชี้ไปหา Note ภายใน Jod ผู้ใช้วางเอง ไม่ผูกกับ Parent/Child
_Avoid_: Internal link, Backlink

**Parent / Child**:
ความสัมพันธ์ใน Tree ระหว่าง Note กับ Note ที่ซ้อนอยู่ข้างใน เป็นอิสระจาก Reference Card
_Avoid_: SubNote (ใช้เฉพาะเป็นชื่อหัวข้อ requirement)

**Placement**:
ตำแหน่งของ Note ใน Tree คือ Parent ที่ Note นั้นอยู่ใต้
_Avoid_: Location, Category

**Unplaced note**:
Note ที่ยังไม่มี Parent และผู้ใช้ยังไม่ได้ตั้งใจให้เป็น Root note เช่น สร้างจากหน้าแรกสุดโดยไม่ได้ใช้ `/Note` ใต้ Note แม่ AI เสนอ Placement ให้ได้ แต่ผู้ใช้เป็นคนตัดสิน
_Avoid_: Inbox note, Orphan

**Root note**:
Note ที่ไม่มี Parent โดยผู้ใช้ตั้งใจ (สร้างให้เป็นระดับบนสุด หรือย้ายออกมาเอง) ต่างจาก Unplaced note ตรงที่ถือว่าจัดวางแล้ว
_Avoid_: Top-level note, Folder

**Context**:
ช่องข้อความแยกจากเนื้อหา ผู้ใช้เขียนเอง ผูกกับ Note เดียว ไม่สืบทอดไป Child ใช้อธิบายจุดประสงค์ของ Note ให้ AI
_Avoid_: Description, Topic context

**Alias**:
ชื่อ/ที่อยู่เดิมของ Note ที่ถูก Merge ซึ่งยังชี้ไปที่ Note ปลายทาง เป็นกลไกเบื้องหลัง ผู้ใช้ไม่เห็น ไม่ใช่ Note
_Avoid_: Redirect note

**Placement Suggestion**:
คำแนะนำจาก AI ว่า Unplaced note ควรอยู่ใต้ Parent ไหน (ตัวเดียว) ผู้ใช้ยืนยันหรือปฏิเสธเอง AI ไม่ตัดสินแทน
_Avoid_: Auto-placement

**Trash**:
ที่เก็บ Note ที่ถูกลบ เปิดดูได้อย่างเดียว กู้คืนได้ ลบถาวรได้เฉพาะผู้ใช้สั่งเอง
_Avoid_: Recycle bin, Archive

**Merge**:
การรวม Note A เข้า Note B ที่ผู้ใช้เลือก เนื้อหาและ Child ของ A ไปอยู่ใน B ย้อนกลับไม่ได้ A กลายเป็น Alias ของ B
_Avoid_: Combine

**Share Link**:
Link ที่ให้คนอื่นดู Note พร้อมลูกหลานทั้งกิ่งได้อย่างเดียว เลือกได้ว่าใครมี Link ก็ดูได้ หรือจำกัดด้วย email
_Avoid_: Public page, Invite

## Retired terms

**Topic**: ไม่ใช่ศัพท์ของระบบ ใช้ "Note ที่มี Child" หรือ "ตำแหน่งใน Tree" แทน
