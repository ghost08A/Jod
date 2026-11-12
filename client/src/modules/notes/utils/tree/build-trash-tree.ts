import type { TrashBranch, TrashNoteItem } from '../../types/note'

const compareById = (a: TrashNoteItem, b: TrashNoteItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * Builds the Trash tree from the flat list. A deleted note whose parent is also in the list hangs under it (by its old position);
 * the others are heads, newest deletion first, then by id. A note in a cycle becomes a head, so nothing is lost or repeated.
 */
export function buildTrashTree(items: TrashNoteItem[]): TrashBranch[] {
    const ids = new Set(items.map((item) => item.id))
    const childrenOf = new Map<string, TrashNoteItem[]>()
    const heads: TrashNoteItem[] = []
    for (const item of items) {
        if (item.parentId !== null && item.parentId !== item.id && ids.has(item.parentId)) {
            childrenOf.set(item.parentId, [...(childrenOf.get(item.parentId) ?? []), item])
        } else {
            heads.push(item)
        }
    }

    const visited = new Set<string>()
    function toBranch(item: TrashNoteItem): TrashBranch {
        visited.add(item.id)
        const children = (childrenOf.get(item.id) ?? [])
            .filter((child) => !visited.has(child.id))
            .sort((a, b) => a.position - b.position || compareById(a, b))
            .map(toBranch)
        return { item, children }
    }

    const byNewestDeletion = (a: TrashNoteItem, b: TrashNoteItem) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt) || compareById(a, b)
    const branches = heads.sort(byNewestDeletion).map(toBranch)
    // Note: notes left over are only reachable from a cycle
    for (const item of [...items].sort(byNewestDeletion)) {
        if (!visited.has(item.id)) branches.push(toBranch(item))
    }
    return branches
}
