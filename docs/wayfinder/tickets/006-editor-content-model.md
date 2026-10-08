Status: closed
Type: grilling
Blocked by: -
Assignee: voramatep

## Question

Block Editor (§2) ในระดับ requirement: Block แต่ละประเภทมีความหมายและข้อจำกัดอะไร (Toggle ซ้อนได้ไหม, List ซ้อนได้กี่ชั้น), Link กับ Reference Card ต่างกันอย่างไรในมุมผู้ใช้, `/Note` สร้าง Child พร้อมแทรก Reference Card เสมอไหม (§5), และเนื้อหา Note ถือเป็น "Block" หรือ "Markdown" ในมุมของผู้ใช้ (กระทบ §14)

Options เดิมก่อนตัดสินใจ (เป็นข้อเสนอ ไม่ใช่ผลลัพธ์ ผลลัพธ์อยู่ใน Resolution):
- Block คือหน่วยจริง Markdown เป็นแค่ Import/Export
- Markdown คือรูปแบบหลัก Block เป็นแค่การแสดงผล
- `/Note` สร้าง Child และแทรก Card เสมอ

## Resolution

ยืนยันโดยผู้ใช้

- Block คือหน่วยจริงของเนื้อหา Markdown เป็นแค่รูปแบบนำเข้า/ส่งออก
- List, Checklist, Toggle ซ้อนได้ไม่จำกัดชั้น และใส่ Block ชนิดไหนไว้ข้างในก็ได้
- เพิ่ม Block ชนิด "ไฟล์" (จาก 011) ต่อจากรายการใน §2
- Link vs Reference Card ตัดสินใน 001 / `/Note` สร้าง Child พร้อมการ์ดตัดสินใน 001-003
