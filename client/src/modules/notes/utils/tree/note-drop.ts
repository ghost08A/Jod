import type { NoteListItem, PlacementRequest } from '../../types/note'
import { canMoveInto, siblingsOf } from './note-placement'

export type DropZone = 'before' | 'inside' | 'after'

/** Where on a row the pointer is, as 0 (top edge) to 1 (bottom edge): the top quarter is before, the bottom quarter is after, the rest is inside */
export function dropZoneAt(ratio: number): DropZone {
    return ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
}

/** `request` is undefined when the note would stay exactly where it is */
export type DropResult = { ok: true; request: PlacementRequest | undefined } | { ok: false; reason: string }

/**
 * The placement request for dropping `draggedId` on the `zone` of the row `targetId`.
 * A top-level unplaced row has no sibling order, so every zone there means inside
 */
export function dropRequest(items: NoteListItem[], draggedId: string, targetId: string, zone: DropZone): DropResult {
    const check = canMoveInto(items, draggedId, targetId)
    const dragged = items.find((item) => item.id === draggedId)
    const target = items.find((item) => item.id === targetId)
    if (!check.ok) return check
    if (!dragged || !target) return { ok: true, request: undefined }

    if (zone === 'inside' || target.placement === 'unplaced') {
        const isLastChild = dragged.placement === 'child' && dragged.parentId === targetId && siblingsOf(items, draggedId).at(-1)?.id === draggedId
        return { ok: true, request: isLastChild ? undefined : { placement: 'child', parentId: targetId } }
    }

    const siblings = siblingsOf(items, targetId)
    const targetIndex = siblings.findIndex((sibling) => sibling.id === targetId)
    const beforeId = zone === 'before' ? targetId : siblings[targetIndex + 1]?.id
    const request: PlacementRequest = target.placement === 'child' && target.parentId !== null ? { placement: 'child', parentId: target.parentId, beforeId } : { placement: 'root', beforeId }
    const draggedIndex = siblings.findIndex((sibling) => sibling.id === draggedId)
    const isSamePlace = draggedIndex !== -1 && (beforeId === draggedId || beforeId === siblings[draggedIndex + 1]?.id)
    return { ok: true, request: isSamePlace ? undefined : request }
}
