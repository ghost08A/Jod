// Note: PROTOTYPE (ticket 021) - command catalog from ticket 020
export type SlashGroup = 'text' | 'note' | 'special'
export type SlashKind = 'insert' | 'link' | 'reference' | 'note'

export interface SlashCommand {
    id: string
    group: SlashGroup
    command: string
    title: string
    description: string
    icon: string
    kind: SlashKind
    insert?: string
    caretAt?: number
    keywords: string[]
}

export const GROUP_LABEL: Record<SlashGroup, string> = {
    text: 'ข้อความและโครงสร้าง',
    note: 'Note และลิงก์',
    special: 'เนื้อหาพิเศษ',
}

const text = (command: string, title: string, description: string, icon: string, insert: string, keywords: string[] = []): SlashCommand =>
    ({ id: command, group: 'text', command, title, description, icon, kind: 'insert', insert, keywords })

const special = (command: string, title: string, description: string, icon: string, insert: string, keywords: string[] = [], caretAt?: number): SlashCommand =>
    ({ id: command, group: 'special', command, title, description, icon, kind: 'insert', insert, caretAt, keywords })

export const SLASH_COMMANDS: SlashCommand[] = [
    text('text', 'ข้อความ', 'ข้อความธรรมดา', 'Aa', '', ['paragraph', 'ย่อหน้า']),
    text('h1', 'หัวข้อ 1', 'หัวข้อใหญ่', 'H1', '# ', ['heading', 'หัวข้อ']),
    text('h2', 'หัวข้อ 2', 'หัวข้อกลาง', 'H2', '## ', ['heading', 'หัวข้อ']),
    text('h3', 'หัวข้อ 3', 'หัวข้อเล็ก', 'H3', '### ', ['heading', 'หัวข้อ']),
    text('bullet', 'รายการจุด', 'รายการหัวข้อย่อย', '•', '• ', ['list', 'จุด']),
    text('numbered', 'รายการเลข', 'รายการเรียงลำดับ', '1.', '1. ', ['list', 'เลข', 'ลำดับ']),
    text('todo', 'รายการทำ', 'รายการ Checkbox', '☐', '☐ ', ['checklist', 'checkbox', 'ทำ']),
    text('quote', 'ข้อความอ้างอิง', 'ข้อความอ้างอิง', '❝', '> ', ['quote', 'อ้างอิง']),
    text('divider', 'เส้นแบ่ง', 'เส้นแบ่งเนื้อหา', '—', '────────\n', ['divider', 'แบ่ง']),
    { id: 'note', group: 'note', command: 'note', title: 'สร้าง Note ลูก', description: 'สร้าง Note ใหม่ไว้ใต้ Note นี้ แล้วแทรกการ์ดไปหา', icon: '＋', kind: 'note', keywords: ['child', 'ลูก', 'new', 'ใหม่'] },
    { id: 'reference', group: 'note', command: 'reference', title: 'การ์ดไปหา Note ที่มีอยู่', description: 'ค้นหา Note ที่มีแล้วแทรกการ์ด ไม่สร้างใหม่ ไม่ย้าย Note นั้น', icon: '↗', kind: 'reference', keywords: ['card', 'การ์ด', 'อ้างอิง', 'link note'] },
    { id: 'link', group: 'note', command: 'link', title: 'ลิงก์เว็บ', description: 'ลิงก์ไปเว็บภายนอก (URL)', icon: '🔗', kind: 'link', keywords: ['url', 'เว็บ', 'http'] },
    special('code', 'โค้ด', 'Code Block', '</>', '```\n\n```', ['code', 'โค้ด'], 4),
    special('image', 'รูปภาพ', 'แทรกรูปภาพ', '🖼', '🖼 [รูปภาพ.png]\n', ['image', 'picture', 'รูป']),
    special('file', 'ไฟล์', 'แนบไฟล์', '📎', '📎 [ไฟล์.pdf]\n', ['attachment', 'แนบ']),
    special('toggle', 'พับ/ขยาย', 'เนื้อหาที่พับและขยายได้', '▸', '▸ ', ['toggle', 'พับ']),
    special('callout', 'ข้อความเน้น', 'ข้อความเน้นสำคัญ', '💡', '💡 ', ['callout', 'เน้น']),
]

export function filterCommands(query: string): SlashCommand[] {
    const needle = query.trim().toLowerCase()
    if (!needle) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter((item) => item.command.startsWith(needle)
        || item.command.includes(needle)
        || item.title.includes(needle)
        || item.keywords.some((keyword) => keyword.includes(needle)))
}
