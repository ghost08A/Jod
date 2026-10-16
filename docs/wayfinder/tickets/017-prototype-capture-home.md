Status: closed
Type: prototype
Blocked by: -
Assignee: voramatep

## Question

หน้าแรกและการจดโน้ตควรหน้าตาและความรู้สึกอย่างไร ให้ "จดก่อน จัดทีหลัง" ทำงานจริง: จัดหน้าแรกอย่างไรระหว่าง Tree กับ "รอจัดวาง", ขั้นตอน Save 3 ทาง (AI / Root note / Unplaced) ขัดจังหวะการจดไหม, Note ว่างที่หายเองรู้สึกปลอดภัยไหม, Title เริ่มต้นและรายการที่ชื่อซ้ำอ่านออกไหม

## Resolution

ผู้ใช้เลือก Layout C จาก Prototype 001

- Writing canvas โล่งใน Dark Theme
- Sidebar กว้างประมาณ 300px และซ่อนได้
- พื้นที่เนื้อหากว้างประมาณ 600px และชิดซ้าย
- Title ขนาดใหญ่
- ปุ่ม "จัดวาง" ขนาดเล็กบริเวณมุมขวาบน
- Prototype เป็น throwaway code แยกอยู่บน branch `prototype/capture-home` ไม่ merge เข้า `dev`

## Follow-up questions (ยังไม่ใช่เหตุผลให้เปิด Ticket กลับ)

- ข้อความเริ่มต้นของ Title (prototype ใช้ "Untitled")
- ความสว่าง/contrast ของข้อความเนื้อหาใน Dark Theme
- พฤติกรรมและหน้าตาเมนู `/` จริง
- Save 3 ทาง, Note ว่าง/Title และ Unplaced จำนวนมาก ยังต้องทดสอบพฤติกรรมตาม checklist ก่อนสรุปว่า UX ของ Capture & Save ผ่านครบ
