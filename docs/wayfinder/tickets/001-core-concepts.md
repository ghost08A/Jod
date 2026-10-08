Status: closed
Type: grilling
Blocked by: -
Assignee: voramatep

## Question

คำศัพท์แกนของ Jod มีความหมายว่าอะไร และเส้นแบ่งระหว่างแต่ละคำอยู่ตรงไหน: Note, Block, Reference Card, Link, Placement, Context, Topic, Alias

เหตุที่ต้องตัดสินก่อน: `requirement.md` ใช้ "Topic" ใน §6 และพูดถึง "Context ของ Topic" ใน §13 แต่ไม่ได้นิยามคำว่า Topic และ Link (§2) กับ Reference Card (§2, §5) อาจทับซ้อนกัน

Options เดิมก่อนตัดสินใจ (เป็นข้อเสนอ ไม่ใช่ผลลัพธ์ ผลลัพธ์อยู่ใน Resolution):
- ไม่มี Topic เป็นเอนทิตีแยก Topic = Parent Note ที่มี Child
- Topic เป็นเอนทิตีแยกจาก Note (ขัดกับ §13 ที่บอกว่า Context ไม่ใช่ของ Topic)
- Link = URL ภายนอก, Reference Card = ชี้ไป Note ภายใน

## Resolution

ยืนยันโดยผู้ใช้ ดูคำนิยามเต็มใน `CONTEXT.md` (ราก)

- Topic ไม่ใช่ศัพท์ของระบบ (ตัดทิ้ง) §6 อ่านว่า "ค้นหาตามตำแหน่งใน Tree"
- Link = URL ภายนอก / Reference Card = Block ที่ชี้ไป Note ภายใน
- Block ไม่ใช่ Note / Reference Card เป็น Block / Parent-Child กับ Reference Card เป็นอิสระต่อกัน
- Placement = Parent ของ Note / Unplaced note = Note ที่ยังไม่มี Parent (เช่น สร้างจากหน้าแรกสุดโดยไม่ใช้ `/Note`) AI เสนอที่วางได้
- Context = ช่องแยกจากเนื้อหา ผูกกับ Note เดียว ไม่สืบทอด
- Alias = กลไกเบื้องหลัง ผู้ใช้ไม่เห็น
