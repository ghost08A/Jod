import type { NoteListItem } from '../../types/note'

/** The parents of a note from the top down (the note itself is not included). Stops at a missing parent or a cycle */
export function noteAncestors(items: NoteListItem[], noteId: string): NoteListItem[] {
    const byId = new Map(items.map((item) => [item.id, item]))
    const path: NoteListItem[] = []
    const seen = new Set([noteId])
    let current = byId.get(noteId)
    while (current && current.placement === 'child' && current.parentId !== null && !seen.has(current.parentId)) {
        const parent = byId.get(current.parentId)
        if (!parent) break
        seen.add(parent.id)
        path.unshift(parent)
        current = parent
    }
    return path
}
