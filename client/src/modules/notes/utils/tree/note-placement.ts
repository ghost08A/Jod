import type { NoteListItem, PlacementRequest } from '../../types/note'

/** The order of siblings: by position, then by id so equal positions always come out the same way */
export function compareSiblings(a: NoteListItem, b: NoteListItem): number {
    return a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** Every note below `noteId` at any depth (the note itself is not included). Safe against cycles */
export function noteDescendantIds(items: NoteListItem[], noteId: string): Set<string> {
    const childrenOf = new Map<string, string[]>()
    for (const item of items) {
        if (item.placement === 'child' && item.parentId !== null) childrenOf.set(item.parentId, [...(childrenOf.get(item.parentId) ?? []), item.id])
    }
    const found = new Set<string>()
    const pending = [noteId]
    while (pending.length > 0) {
        for (const childId of childrenOf.get(pending.pop() as string) ?? []) {
            if (childId !== noteId && !found.has(childId)) {
                found.add(childId)
                pending.push(childId)
            }
        }
    }
    return found
}

export const CANNOT_MOVE_INTO_SELF_REASON = 'ย้ายเข้าตัวเองหรือลูกหลานของตัวเองไม่ได้'

export type MoveCheck = { ok: true } | { ok: false; reason: string }

export function canMoveInto(items: NoteListItem[], noteId: string, targetId: string): MoveCheck {
    if (targetId === noteId || noteDescendantIds(items, noteId).has(targetId)) return { ok: false, reason: CANNOT_MOVE_INTO_SELF_REASON }
    return { ok: true }
}

/** The note and its siblings in order: root notes among root notes, children among the children of the same parent. An unplaced note has none */
export function siblingsOf(items: NoteListItem[], noteId: string): NoteListItem[] {
    const note = items.find((item) => item.id === noteId)
    if (!note || note.placement === 'unplaced') return []
    return items.filter((item) => item.placement === note.placement && item.parentId === note.parentId).sort(compareSiblings)
}

export type SiblingDirection = 'up' | 'down'

/**
 * The placement request that moves the note one step among its siblings, or undefined at the first (up) or last (down) place.
 * Up goes before the previous sibling. Down goes before the sibling after the next one, or last when the next one is the last
 */
export function siblingMoveRequest(items: NoteListItem[], noteId: string, direction: SiblingDirection): PlacementRequest | undefined {
    const note = items.find((item) => item.id === noteId)
    const siblings = siblingsOf(items, noteId)
    const index = siblings.findIndex((sibling) => sibling.id === noteId)
    if (!note || index === -1) return undefined
    const beforeId = direction === 'up' ? siblings[index - 1]?.id : siblings[index + 2]?.id
    if (direction === 'up' ? index === 0 : index === siblings.length - 1) return undefined
    return note.placement === 'child' && note.parentId !== null
        ? { placement: 'child', parentId: note.parentId, beforeId }
        : { placement: 'root', beforeId }
}
