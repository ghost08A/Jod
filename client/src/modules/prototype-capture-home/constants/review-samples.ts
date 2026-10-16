import type { ReviewRow } from '../types/review-block'

const protectedRows: ReviewRow[] = [
    { id: 'p1', change: 'same', left: { kind: 'reference', text: 'โปรเจกต์ A' }, right: { kind: 'reference', text: 'โปรเจกต์ A' } },
    { id: 'p2', change: 'same', left: { kind: 'code', text: "SELECT * FROM orders WHERE customer = 'B2B'" }, right: { kind: 'code', text: "SELECT * FROM orders WHERE customer = 'B2B'" } },
    { id: 'p3', change: 'same', left: { kind: 'link', text: 'https://example.com/pricing' }, right: { kind: 'link', text: 'https://example.com/pricing' } },
    { id: 'p4', change: 'same', left: { kind: 'file', text: 'quote-draft.pdf' }, right: { kind: 'file', text: 'quote-draft.pdf' } },
]

export const FORMAT_ROWS: ReviewRow[] = [
    { id: 'f1', change: 'added', right: { kind: 'paragraph', text: 'สรุป: ลูกค้าต้องการส่วนลดและให้ส่งมอบภายในสิ้นเดือน' } },
    { id: 'f2', change: 'added', right: { kind: 'heading', text: 'สิ่งที่คุยกัน' } },
    {
        id: 'f3', change: 'edited',
        left: { kind: 'paragraph', text: 'คุยเรื่องราคา ลูกค้าอยากได้ส่วนลด 10% ถ้าสั่งเกิน 100 ชุด' },
        right: { kind: 'bullet', text: 'ราคา: ลูกค้าขอส่วนลด 10% ถ้าสั่งเกิน 100 ชุด' },
    },
    {
        id: 'f4', change: 'edited',
        left: { kind: 'paragraph', text: 'ส่งมอบภายในสิ้นเดือน ต้องเช็กกับทีมผลิตก่อน' },
        right: { kind: 'bullet', text: 'กำหนดส่ง: ภายในสิ้นเดือน (ต้องเช็กกับทีมผลิตก่อน)' },
    },
    { id: 'f5', change: 'removed', left: { kind: 'paragraph', text: 'ต้องทำ ส่งใบเสนอราคาใหม่ นัดทีมผลิตวันพฤหัส โทรกลับลูกค้า' } },
    { id: 'f6', change: 'added', right: { kind: 'heading', text: 'งานที่ต้องทำ' } },
    { id: 'f7', change: 'added', right: { kind: 'checklist', text: 'ส่งใบเสนอราคาใหม่' } },
    { id: 'f8', change: 'added', right: { kind: 'checklist', text: 'นัดทีมผลิตวันพฤหัส' } },
    { id: 'f9', change: 'added', right: { kind: 'checklist', text: 'โทรกลับลูกค้า' } },
    ...protectedRows,
    {
        id: 'f10', change: 'same',
        left: { kind: 'paragraph', text: 'เรื่องอื่น ลูกค้าสนใจแพ็กเกจ support รายปี' },
        right: { kind: 'paragraph', text: 'เรื่องอื่น ลูกค้าสนใจแพ็กเกจ support รายปี' },
    },
]

export const CONFLICT_ROWS: ReviewRow[] = [
    { id: 'c1', change: 'same', left: { kind: 'paragraph', text: 'ประชุมลูกค้า B2B วันพุธ' }, right: { kind: 'paragraph', text: 'ประชุมลูกค้า B2B วันพุธ' } },
    {
        id: 'c2', change: 'edited',
        left: { kind: 'paragraph', text: 'ลูกค้าอยากได้ส่วนลด 10% ถ้าสั่งเกิน 100 ชุด' },
        right: { kind: 'paragraph', text: 'ลูกค้าอยากได้ส่วนลด 15% ถ้าสั่งเกิน 200 ชุด' },
    },
    { id: 'c3', change: 'removed', left: { kind: 'paragraph', text: 'ต้องเช็กกับทีมผลิตก่อนตอบ' } },
    { id: 'c4', change: 'added', right: { kind: 'checklist', text: 'ส่งใบเสนอราคาใหม่ภายในวันศุกร์' } },
    { id: 'c5', change: 'same', left: { kind: 'reference', text: 'โปรเจกต์ A' }, right: { kind: 'reference', text: 'โปรเจกต์ A' } },
]

export const CHANGE_LABEL = {
    format: { added: 'AI เพิ่ม', edited: 'AI แก้', removed: 'AI แตกเป็นรูปแบบใหม่', same: '' },
    conflict: { added: 'มีเฉพาะอีกแท็บ', edited: 'สองแท็บแก้ไม่ตรงกัน', removed: 'มีเฉพาะแท็บนี้', same: '' },
} as const
