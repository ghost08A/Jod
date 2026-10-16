import type { ReviewItem } from '../types/review-block'

const para = (text: string) => ({ kind: 'paragraph' as const, text })

export const REVIEW_ITEMS: ReviewItem[] = [
    { kind: 'context', id: 'k1', block: para('ประชุมลูกค้า B2B วันพุธ') },
    {
        kind: 'change',
        group: { id: 'g1', type: 'add', left: [], right: [para('สรุป: ลูกค้าต้องการส่วนลดและให้ส่งมอบภายในสิ้นเดือน')] },
    },
    {
        kind: 'change',
        group: {
            id: 'g2', type: 'edit',
            left: [para('คุยเรื่องราคา ลูกค้าอยากได้ส่วนลด 10% ถ้าสั่งเกิน 100 ชุด')],
            right: [{ kind: 'bullet', text: 'ราคา: ลูกค้าขอส่วนลด 10% ถ้าสั่งเกิน 100 ชุด' }],
        },
    },
    {
        kind: 'change',
        group: {
            id: 'g3', type: 'edit',
            left: [para('ส่งมอบภายในสิ้นเดือน ต้องเช็กกับทีมผลิตก่อน')],
            right: [{ kind: 'bullet', text: 'กำหนดส่ง: ภายในสิ้นเดือน (ต้องเช็กกับทีมผลิตก่อน)' }],
        },
    },
    {
        kind: 'change',
        group: {
            id: 'g4', type: 'split', relation: '1 ย่อหน้า → 4 Block',
            left: [para('ต้องทำ ส่งใบเสนอราคาใหม่ นัดทีมผลิตวันพฤหัส โทรกลับลูกค้า')],
            right: [
                { kind: 'heading', text: 'งานที่ต้องทำ' },
                { kind: 'checklist', text: 'ส่งใบเสนอราคาใหม่' },
                { kind: 'checklist', text: 'นัดทีมผลิตวันพฤหัส' },
                { kind: 'checklist', text: 'โทรกลับลูกค้า' },
            ],
        },
    },
    { kind: 'context', id: 'k2', block: { kind: 'reference', text: 'โปรเจกต์ A' } },
    { kind: 'context', id: 'k3', block: { kind: 'code', text: "SELECT * FROM orders WHERE customer = 'B2B'" } },
    {
        kind: 'change',
        group: {
            id: 'g5', type: 'edit',
            left: [{ kind: 'link', text: 'https://example.com/pricing' }],
            right: [{ kind: 'link', text: 'https://example.com/price-list' }],
            blockedReason: 'AI พยายามเปลี่ยน Link ซึ่งระบบกำหนดให้คงไว้ จึงใช้ได้เฉพาะฉบับเดิม',
        },
    },
    { kind: 'context', id: 'k4', block: { kind: 'file', text: 'quote-draft.pdf' } },
    {
        kind: 'change',
        group: {
            id: 'g6', type: 'merge', relation: '2 ย่อหน้า → 1 Block',
            left: [para('เรื่องอื่น'), para('ลูกค้าสนใจแพ็กเกจ support รายปี')],
            right: [para('เรื่องอื่น: ลูกค้าสนใจแพ็กเกจ support รายปี')],
        },
    },
    {
        kind: 'change',
        group: {
            id: 'g7', type: 'move', relation: 'ย้ายไปท้าย Note', movesToEnd: true,
            left: [para('โทรหาซัพพลายเออร์เรื่องวัตถุดิบ')],
            right: [para('โทรหาซัพพลายเออร์เรื่องวัตถุดิบ')],
        },
    },
    {
        kind: 'change',
        group: { id: 'g8', type: 'remove', left: [para('(ทดสอบ) ไม่ต้องสนใจบรรทัดนี้')], right: [] },
    },
]
