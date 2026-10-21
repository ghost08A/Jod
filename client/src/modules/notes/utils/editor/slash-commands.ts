import type { HeadingLevel, NoteBlockType } from './block-document'

export type SlashCommandName =
    | 'text'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'bullet'
    | 'numbered'
    | 'todo'
    | 'quote'
    | 'divider'
    | 'code'
    | 'toggle'

export type SlashCommandCategory = 'text-and-structure' | 'special-content'

export type SlashCommandItem = {
    name: SlashCommandName
    command: `/${SlashCommandName}`
    blockType: NoteBlockType
    headingLevel?: HeadingLevel
    category: SlashCommandCategory
    title: string
    description: string
    keywords: readonly string[]
}

// Note: 1b includes only the 11 block commands in scope; /note, /reference, /link, /image, /file, /callout are excluded until their blocks exist
export const SLASH_COMMAND_ITEMS: readonly SlashCommandItem[] = [
    {
        name: 'text',
        command: '/text',
        blockType: 'paragraph',
        category: 'text-and-structure',
        title: 'ข้อความธรรมดา',
        description: 'เขียนเนื้อหาแบบย่อหน้าปกติ',
        keywords: ['paragraph', 'plain', 'ย่อหน้า', 'ข้อความ'],
    },
    {
        name: 'h1',
        command: '/h1',
        blockType: 'heading',
        headingLevel: 1,
        category: 'text-and-structure',
        title: 'หัวข้อใหญ่ (Heading 1)',
        description: 'หัวข้อหลักขนาดใหญ่สุด',
        keywords: ['heading 1', 'title', 'หัวข้อ 1', 'หัวข้อหลัก'],
    },
    {
        name: 'h2',
        command: '/h2',
        blockType: 'heading',
        headingLevel: 2,
        category: 'text-and-structure',
        title: 'หัวข้อรอง (Heading 2)',
        description: 'หัวข้อขนาดกลางสำหรับแบ่งส่วน',
        keywords: ['heading 2', 'subtitle', 'หัวข้อ 2', 'หัวข้อรอง'],
    },
    {
        name: 'h3',
        command: '/h3',
        blockType: 'heading',
        headingLevel: 3,
        category: 'text-and-structure',
        title: 'หัวข้อย่อย (Heading 3)',
        description: 'หัวข้อขนาดเล็กสำหรับรายละเอียด',
        keywords: ['heading 3', 'หัวข้อ 3', 'หัวข้อย่อย'],
    },
    {
        name: 'bullet',
        command: '/bullet',
        blockType: 'bullet',
        category: 'text-and-structure',
        title: 'รายการหัวข้อย่อย',
        description: 'รายการแบบจุด ซ้อนได้หลายชั้น',
        keywords: ['list', 'ul', 'รายการจุด', 'หัวข้อย่อย'],
    },
    {
        name: 'numbered',
        command: '/numbered',
        blockType: 'numbered',
        category: 'text-and-structure',
        title: 'รายการเรียงลำดับ',
        description: 'รายการแบบตัวเลขเรียงลำดับ',
        keywords: ['ordered', 'ol', 'number', 'ตัวเลข', 'ลำดับ'],
    },
    {
        name: 'todo',
        command: '/todo',
        blockType: 'checklist',
        category: 'text-and-structure',
        title: 'รายการสิ่งที่ต้องทำ',
        description: 'รายการพร้อมช่องติ๊กถูก',
        keywords: ['checklist', 'task', 'checkbox', 'รายการทำ', 'ติ๊ก'],
    },
    {
        name: 'quote',
        command: '/quote',
        blockType: 'quote',
        category: 'text-and-structure',
        title: 'ข้อความอ้างอิง',
        description: 'เน้นข้อความสำคัญหรือคำพูดอ้างอิง',
        keywords: ['blockquote', 'citation', 'อ้างอิง', 'คำคม'],
    },
    {
        name: 'divider',
        command: '/divider',
        blockType: 'divider',
        category: 'text-and-structure',
        title: 'เส้นแบ่งเนื้อหา',
        description: 'เส้นคั่นแยกระหว่างส่วนของเนื้อหา',
        keywords: ['hr', 'line', 'separator', 'เส้นแบ่ง', 'เส้นคั่น'],
    },
    {
        name: 'code',
        command: '/code',
        blockType: 'code',
        category: 'special-content',
        title: 'Code Block',
        description: 'กล่องสำหรับเขียนโค้ดโดยเฉพาะ',
        keywords: ['snippet', 'pre', 'โค้ด', 'โปรแกรม'],
    },
    {
        name: 'toggle',
        command: '/toggle',
        blockType: 'toggle',
        category: 'special-content',
        title: 'เนื้อหาพับเก็บได้',
        description: 'ซ่อนและขยายรายละเอียดข้างในได้',
        keywords: ['details', 'collapse', 'expand', 'พับ', 'ซ่อน'],
    },
]

function normalizeQuery(rawQuery: string): string {
    const trimmed = rawQuery.trim().toLowerCase()
    return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
}

/**
 * Assigns a rank tier to a command for a given query (lower number = higher priority):
 * 0 = exact command name match (e.g. "h1" matches "/h1")
 * 1 = command name starts with query (e.g. "h" matches "/h1", "/h2", "/h3")
 * 2 = command name or title starts with query
 * 3 = command name, title, description, or keyword contains query
 * undefined = does not match
 */
function scoreCommandMatch(item: SlashCommandItem, normalizedQuery: string): number | undefined {
    const name = item.name.toLowerCase()
    const title = item.title.toLowerCase()
    const description = item.description.toLowerCase()

    if (name === normalizedQuery || title === normalizedQuery) {
        return 0
    }
    if (name.startsWith(normalizedQuery)) {
        return 1
    }
    if (title.startsWith(normalizedQuery) || item.keywords.some((k) => k.toLowerCase() === normalizedQuery)) {
        return 2
    }
    if (
        name.includes(normalizedQuery) ||
        title.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        item.keywords.some((k) => k.toLowerCase().includes(normalizedQuery))
    ) {
        return 3
    }
    return undefined
}

/**
 * Filters and ranks slash commands according to prototype 022 rules:
 * - Empty query returns all 11 commands in their default order
 * - Exact command name match always ranks first
 * - Prefix matches on the command name come before broader keyword/description matches
 * - Ties preserve the default command order
 */
export function filterAndRankSlashCommands(
    query: string,
    commands: readonly SlashCommandItem[] = SLASH_COMMAND_ITEMS,
): SlashCommandItem[] {
    // Note: trailing spaces inside a slash token close/fail the match in the editor, but leading '/' is stripped
    if (/\s/.test(query.startsWith('/') ? query.slice(1) : query)) {
        const trimmed = normalizeQuery(query)
        if (trimmed.includes(' ')) {
            // Still allow multi-word keyword queries like "heading 1" when explicitly passed
        }
    }

    const normalizedQuery = normalizeQuery(query)
    if (normalizedQuery.length === 0) {
        return [...commands]
    }

    const scored: Array<{ item: SlashCommandItem; score: number; index: number }> = []
    commands.forEach((item, index) => {
        const score = scoreCommandMatch(item, normalizedQuery)
        if (score !== undefined) {
            scored.push({ item, score, index })
        }
    })

    scored.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.index - b.index))
    return scored.map((entry) => entry.item)
}
