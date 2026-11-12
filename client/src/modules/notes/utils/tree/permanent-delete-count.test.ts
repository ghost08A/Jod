import { describe, expect, it } from 'vitest'
import type { TrashNoteItem } from '../../types/note'
import { permanentDeleteCount } from './permanent-delete-count'

const STAMP = '2026-01-01T10:00:00Z'
function trashed(id: string, parentId: string | null = null, trashBatchId = 'b'): TrashNoteItem {
    return { id, title: id, deletedAt: STAMP, trashBatchId, placement: parentId ? 'child' : 'root', parentId, position: 0 }
}

describe('permanentDeleteCount', () => {
    it('is 0 when the note is not in the list', () => {
        expect(permanentDeleteCount([trashed('a')], 'x')).toBe(0)
    })

    it('is 1 for a note without deleted children', () => {
        expect(permanentDeleteCount([trashed('a'), trashed('b')], 'a')).toBe(1)
    })

    it('counts the whole deleted branch from its head', () => {
        const items = [trashed('p'), trashed('k', 'p'), trashed('g', 'k'), trashed('other')]
        expect(permanentDeleteCount(items, 'p')).toBe(3)
    })

    it('counts only the part below a middle note', () => {
        const items = [trashed('p'), trashed('k', 'p'), trashed('g', 'k')]
        expect(permanentDeleteCount(items, 'k')).toBe(2)
    })

    it('ignores a child of the same parent that was deleted in another action', () => {
        const items = [trashed('p', null, 'second'), trashed('c', 'p', 'first')]
        expect(permanentDeleteCount(items, 'p')).toBe(1)
    })
})
