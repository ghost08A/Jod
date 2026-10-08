# Jod — Initial Feature Requirements

## เป้าหมายของโปรเจกต์

สร้างแอปจดโน้ต/Knowledge Management ชื่อ Jod ใหม่จากศูนย์

แนวคิดหลัก:

จดก่อน จัดทีหลัง
UX คล้าย Notion
Note สามารถซ้อนกันเป็น Tree ได้
Note ใช้ Block Editor
AI ช่วยจัดระเบียบและเข้าใจ Note
นำเฉพาะ Feature / Product Idea ที่ต้องการมาใช้

สำคัญ: ตอนนี้อยู่ในช่วงวาง Product Design ห้ามกระโดดไป Database / API / Code จนกว่า Requirements, User Flow และ Business Rules จะชัดเจน

## 1. Note

- ผู้ใช้สามารถสร้าง Note ได้
- Note ทุกอันต้องมี Title
- ผู้ใช้สามารถแก้ไข Title ได้
- ผู้ใช้สามารถเขียนเนื้อหาภายใน Note ได้
- ผู้ใช้สามารถแก้ไขเนื้อหาภายใน Note ได้
- ระบบบันทึกเนื้อหาโดยอัตโนมัติ (Autosave)


## 2. Note Editor

- ผู้ใช้สามารถเขียนเนื้อหาแบบ Block ได้
- ผู้ใช้สามารถเพิ่ม แก้ไข และลบ Block ได้
- ผู้ใช้สามารถจัดลำดับ Block ได้
- รองรับ Block ประเภท:
  - Paragraph
  - Heading
  - Bullet List
  - Numbered List
  - Checklist
  - Toggle List (Toggle Block)
  - Quote
  - Code Block
  - Divider
  - Link
  - Reference Card

## 3. Note Hierarchy

* Note สามารถซ้อน Note ได้ไม่จำกัดระดับ
* Note สามารถมี Parent และ Child ได้
* ผู้ใช้สามารถ Browse Note ในรูปแบบ Tree
* ผู้ใช้สามารถพับ / ขยาย Tree ได้
* ผู้ใช้สามารถย้าย Note ไปยัง Parent อื่นได้
* ผู้ใช้สามารถใช้ Breadcrumb เพื่อย้อนกลับไปยัง Parent ของ Note ได้


## 4. Note Page

* ผู้ใช้สามารถเปิด Note เป็นหน้าเต็มได้
* Title สามารถแก้ไขแบบ Inline ได้
* ผู้ใช้สามารถเขียนเนื้อหาโดยตรงใน Editor
* Note มี Actions สำหรับการจัดการ เช่น:

  * Move
  * Delete


## 5. Note Reference / SubNote

* ผู้ใช้สามารถสร้าง Child Note จากภายใน Editor ผ่านคำสั่ง `/Note`
* ระบบสามารถแทรก Reference Card ของ Note ลงในเนื้อหา
* ผู้ใช้สามารถเปิด Reference Card เพื่อไปยัง Note ที่อ้างอิงได้
* Reference Card ยังคงสามารถเปิดไปยัง Note เดิมได้ แม้ Note จะถูกย้าย
* Reference Card ยังคงสามารถเปิดไปยัง Note เดิมได้เมื่อ Note ถูก Merge


## 6. Search & Filter

* ผู้ใช้สามารถค้นหา Note ได้
* ค้นหาจากชื่อ Note
* ค้นหาจากเนื้อหา Note
* ค้นหาตาม Topic / Hierarchy
* Filter Note ตาม Parent


## 7. AI Organization

* AI สามารถวิเคราะห์ Note ใหม่ได้
* AI สามารถวิเคราะห์ Parent ที่เหมาะสม
* AI สามารถแนะนำ Placement ของ Note
* ผู้ใช้สามารถยืนยัน Placement ที่ AI แนะนำ
* ผู้ใช้สามารถปฏิเสธ Placement ที่ AI แนะนำ
* ระบบสามารถแสดง Note ที่มี Placement Suggestion

> AI เป็นผู้แนะนำ ไม่ใช่ผู้ตัดสินใจแทนผู้ใช้


## 8. Trash

* ผู้ใช้สามารถลบ Note ได้
* ผู้ใช้สามารถลบทั้งต้นไม้ของ Note ได้
* ผู้ใช้สามารถเปิดดู Note ที่อยู่ใน Trash ได้
* ระบบแสดงสถานะว่า Note ถูกลบ
* ผู้ใช้สามารถกู้คืน Note ได้


## 9. Merge

* ผู้ใช้สามารถ Merge Note ได้
* Reference เดิมต้องยังสามารถนำทางไปยัง Note ที่ถูก Merge ได้
* ระบบสามารถใช้ Redirect / Alias เพื่อรักษา Reference เดิม


## 10. Error Logging

* ระบบสามารถบันทึก Error ที่เกิดขึ้นภายในระบบ
* Error ต้องสามารถนำไปตรวจสอบและวิเคราะห์ปัญหาได้


## 11. Email Verification

* ผู้ใช้สามารถยืนยัน Email ได้
* ระบบต้องตรวจสอบสถานะการยืนยัน Email ของผู้ใช้

## 12. Concurrent Editing Detection

* ระบบสามารถตรวจจับกรณีที่ Note เดียวกันถูกแก้ไขพร้อมกัน
* ระบบต้องตรวจจับกรณีที่การบันทึกข้อมูลชนกับข้อมูลที่ถูกแก้ไขโดยผู้ใช้อื่น
* ผู้ใช้ต้องได้รับแจ้งเมื่อเกิดการบันทึกชนกัน


## 13. Note Context สำหรับ AI
* Note แต่ละ Note สามารถกำหนด Context ของตัวเองได้
* Context ใช้สำหรับอธิบายความหมาย จุดประสงค์ หรือข้อมูลเพิ่มเติมเกี่ยวกับ Note นั้น
* Context ช่วยให้ AI เข้าใจเนื้อหาและบริบทของ Note ได้ดีขึ้น
* AI สามารถใช้ Context ร่วมกับเนื้อหาและข้อมูลอื่นของ Note ในการวิเคราะห์
* Context ของแต่ละ Note เป็นข้อมูลเฉพาะของ Note นั้น และไม่ใช่ Context แยกของ Topic
* ผู้ใช้สามารถ แก้ไข หรือปรับปรุง Context ของ Note ได้


## 14. AI Markdown Formatting

* AI สามารถวิเคราะห์และจัดโครงสร้างเนื้อหา Markdown ได้
* AI ต้องรักษาโครงสร้างของเนื้อหาเดิมระหว่างการประมวลผล
* การประมวลผลของ AI ต้องไม่ทำให้โครงสร้างหรือความหมายของ Markdown เดิมเสียหาย


## 15. Attachments

* ผู้ใช้สามารถแนบไฟล์กับ Note ได้
* Attachment ต้องสามารถเชื่อมโยงกับ Note ที่เป็นเจ้าของไฟล์ได้


## 16. Share Link

* ผู้ใช้สามารถสร้าง Link สำหรับแชร์ Note ได้
* ผู้รับ Link สามารถเข้าถึง Note ที่ถูกแชร์ได้ตามสิทธิ์ที่ระบบกำหนด