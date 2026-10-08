import type { PrototypeNote } from '../types/prototype-note'

export const DEFAULT_TITLE = 'ไม่มีชื่อ'

const base = { rejectedParentIds: [], isDraft: false }

export const SEED_NOTES: PrototypeNote[] = [
    { ...base, id: 'work', title: 'งาน', body: '', placement: 'root' },
    { ...base, id: 'meeting', title: 'ประชุมลูกค้า', body: 'สรุปประชุมกับลูกค้า B2B', placement: 'child', parentId: 'work' },
    { ...base, id: 'projectA', title: 'โปรเจกต์ A', body: '', placement: 'child', parentId: 'work' },
    { ...base, id: 'life', title: 'ส่วนตัว', body: '', placement: 'root' },
    { ...base, id: 'japan', title: 'เที่ยวญี่ปุ่น', body: 'แผนเที่ยวญี่ปุ่นเดือนหน้า', placement: 'child', parentId: 'life' },
    { ...base, id: 'health', title: 'สุขภาพ', body: '', placement: 'child', parentId: 'life' },
    {
        ...base, id: 'u1', title: 'ตั๋วเครื่องบินไปโตเกียว', body: 'เช็กราคาตั๋วไปโตเกียวช่วงปลายเดือน',
        placement: 'unplaced', suggestion: { state: 'ready', parentId: 'japan' },
    },
    { ...base, id: 'u2', title: 'ไอเดียฟีเจอร์ค้นหา', body: 'ค้นหาจากชื่อและเนื้อหา', placement: 'unplaced' },
    { ...base, id: 'u3', title: '', body: 'โทรนัดหมอฟัน วันพฤหัส', placement: 'unplaced' },
    { ...base, id: 'u4', title: '', body: 'ซื้อนมกับไข่', placement: 'unplaced' },
    { ...base, id: 'u5', title: 'ออกกำลังกาย', body: 'วิ่งสัปดาห์ละ 3 วัน', placement: 'unplaced' },
]

export const KEYWORD_PARENTS: Array<{ keywords: string[], parentId: string }> = [
    { keywords: ['ญี่ปุ่น', 'โตเกียว', 'เที่ยว'], parentId: 'japan' },
    { keywords: ['ประชุม', 'ลูกค้า'], parentId: 'meeting' },
    { keywords: ['โปรเจกต์', 'งาน'], parentId: 'work' },
    { keywords: ['ออกกำลัง', 'สุขภาพ', 'หมอ'], parentId: 'health' },
]
