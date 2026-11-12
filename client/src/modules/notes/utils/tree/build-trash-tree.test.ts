import { describe, expect, it } from 'vitest'
import type { TrashBranch, TrashNoteItem } from '../../types/note'
import { buildTrashTree } from './build-trash-tree'

function trashed(id: string, deletedAt: string, parentId: string | null = null, position = 0): TrashNoteItem {
    return { id, title: id, deletedAt, trashBatchId: 'b', placement: parentId ? 'child' : 'root', parentId, position }
}
const ids = (branches: TrashBranch[]) => branches.map((branch) => branch.item.id)

describe('buildTrashTree', () => {
    it('is empty for an empty list', () => {
        expect(buildTrashTree([])).toEqual([])
    })

    it('puts heads newest deletion first, ties by id', () => {
        const tree = buildTrashTree([
            trashed('a', '2026-01-01T10:00:00Z'),
            trashed('c', '2026-01-02T10:00:00Z'),
            trashed('b', '2026-01-02T10:00:00Z'),
        ])
        expect(ids(tree)).toEqual(['b', 'c', 'a'])
    })

    it('hangs a deleted note under its deleted parent, by old position', () => {
        const stamp = '2026-01-01T10:00:00Z'
        const tree = buildTrashTree([trashed('k2', stamp, 'p', 2), trashed('p', stamp), trashed('k1', stamp, 'p', 1), trashed('g', stamp, 'k1')])
        expect(ids(tree)).toEqual(['p'])
        expect(ids(tree[0].children)).toEqual(['k1', 'k2'])
        expect(ids(tree[0].children[0].children)).toEqual(['g'])
    })

    it('makes a note a head when its parent is not in Trash', () => {
        expect(ids(buildTrashTree([trashed('x', '2026-01-01T10:00:00Z', 'alive')]))).toEqual(['x'])
    })

    it('does not lose or repeat notes in a cycle or a self-parent', () => {
        const stamp = '2026-01-01T10:00:00Z'
        const tree = buildTrashTree([trashed('a', stamp, 'b'), trashed('b', stamp, 'a'), trashed('s', stamp, 's')])
        const all: string[] = []
        const walk = (branches: TrashBranch[]) => branches.forEach((branch) => (all.push(branch.item.id), walk(branch.children)))
        walk(tree)
        expect(all.sort()).toEqual(['a', 'b', 's'])
    })
})
