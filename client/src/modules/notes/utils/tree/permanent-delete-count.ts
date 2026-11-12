import type { TrashBranch, TrashNoteItem } from '../../types/note'
import { buildTrashTree } from './build-trash-tree'

function findBranch(branches: TrashBranch[], noteId: string): TrashBranch | undefined {
    for (const branch of branches) {
        if (branch.item.id === noteId) return branch
        const found = findBranch(branch.children, noteId)
        if (found) return found
    }
    return undefined
}

function countBranch(branch: TrashBranch): number {
    return 1 + branch.children.reduce((total, child) => total + countBranch(child), 0)
}

/** How many notes a permanent delete of `noteId` removes: the note and its descendants of the same deletion still in Trash. 0 when it is not in the list */
export function permanentDeleteCount(items: TrashNoteItem[], noteId: string): number {
    const branch = findBranch(buildTrashTree(items), noteId)
    return branch ? countBranch(branch) : 0
}
