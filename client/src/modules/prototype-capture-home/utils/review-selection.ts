import { PROTECTED_KINDS, type ChangeGroup, type Pick, type PreviewRow, type ReviewItem, type Selection } from '../types/review-block'

export function changeGroups(items: ReviewItem[]): ChangeGroup[] {
    return items.flatMap((item) => (item.kind === 'change' ? [item.group] : []))
}

// Note: default = keep everything original, so nothing changes unless the user picks it
export function bulkSelection(items: ReviewItem[], pick: Pick): Selection {
    const selection: Selection = {}
    changeGroups(items).forEach((group) => {
        selection[group.id] = pick
    })
    return selection
}

export function summarize(items: ReviewItem[], selection: Selection) {
    const groups = changeGroups(items)
    const ai = groups.filter((group) => selection[group.id] === 'ai').length
    return {
        total: groups.length,
        ai,
        original: groups.length - ai,
        protectedUnchanged: items.filter((item) => item.kind === 'context' && PROTECTED_KINDS.includes(item.block.kind)).length,
    }
}

const GHOST_TEXT = {
    add: 'ไม่รับ Block ที่ AI เสนอเพิ่ม',
    remove: 'นำ Block เดิมออกตามที่ AI เสนอ',
    move: 'ย้ายไปท้าย Note แล้ว',
} as const

export function buildPreview(items: ReviewItem[], selection: Selection): PreviewRow[] {
    const rows: PreviewRow[] = []
    const tail: PreviewRow[] = []
    items.forEach((item) => {
        if (item.kind === 'context') {
            rows.push({ id: item.id, block: item.block, fromAi: false })
            return
        }
        const { group } = item
        const useAi = selection[group.id] === 'ai'
        const blocks = useAi ? group.right : group.left
        blocks.forEach((block, index) => {
            const row: PreviewRow = { id: `${group.id}-${index}`, block, groupId: group.id, fromAi: useAi }
            if (useAi && group.movesToEnd) tail.push(row)
            else rows.push(row)
        })
        const ghost = (group.type === 'add' && !useAi) || (group.type === 'remove' && useAi)
            ? GHOST_TEXT[group.type]
            : group.type === 'move' && useAi ? GHOST_TEXT.move : undefined
        if (ghost) rows.push({ id: `${group.id}-ghost`, ghost, groupId: group.id, fromAi: useAi })
    })
    return [...rows, ...tail]
}
