import type { NoteBranch, NoteListItem } from '../../types/note'
import { compareSiblings } from './note-placement'

/**
 * Builds the sidebar tree from the flat list (which the server sorts newest change first).
 * Top level: `unplaced` keeps the list order, `root` is ordered by position. A child hangs under its parent by
 * position, at any depth. A child whose parent is not in the list, or that sits in a cycle, becomes a top-level unplaced note.
 */
export function buildNoteTree(items: NoteListItem[]): { unplaced: NoteBranch[]; root: NoteBranch[] } {
    const ids = new Set(items.map((item) => item.id))
    const childrenOf = new Map<string, NoteListItem[]>()
    const topLevel: NoteListItem[] = []
    for (const item of items) {
        if (item.placement === 'child' && item.parentId !== null && item.parentId !== item.id && ids.has(item.parentId)) {
            childrenOf.set(item.parentId, [...(childrenOf.get(item.parentId) ?? []), item])
        } else {
            topLevel.push(item)
        }
    }

    const visited = new Set<string>()
    function toBranch(item: NoteListItem): NoteBranch {
        visited.add(item.id)
        const children = (childrenOf.get(item.id) ?? [])
            .filter((child) => !visited.has(child.id))
            .sort(compareSiblings)
            .map(toBranch)
        return { item, children }
    }

    const unplaced: NoteBranch[] = []
    const root: NoteBranch[] = []
    for (const item of topLevel) {
        if (item.placement === 'root') root.push(toBranch(item))
        else unplaced.push(toBranch(item))
    }
    root.sort((a, b) => compareSiblings(a.item, b.item))
    // Note: notes left over here are only reachable from a cycle, so they are shown as top-level unplaced
    for (const item of items) {
        if (!visited.has(item.id)) unplaced.push(toBranch(item))
    }
    return { unplaced, root }
}
