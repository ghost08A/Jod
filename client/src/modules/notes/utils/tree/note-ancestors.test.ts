import { describe, expect, it } from 'vitest'
import type { NoteListItem, NotePlacement } from '../../types/note'
import { noteAncestors } from './note-ancestors'

function note(id: string, placement: NotePlacement, parentId: string | null = null): NoteListItem {
    return { id, title: id, updatedAt: '2026-01-01T00:00:00Z', placement, parentId, position: 0 }
}
const idsOf = (items: NoteListItem[], id: string) => noteAncestors(items, id).map((item) => item.id)

describe('noteAncestors', () => {
    const items = [note('c', 'child', 'b'), note('b', 'child', 'a'), note('a', 'root')]

    it('lists parents from the top down', () => {
        expect(idsOf(items, 'c')).toEqual(['a', 'b'])
    })
    it('is empty for a top-level note, an empty list and an unknown id', () => {
        expect(idsOf(items, 'a')).toEqual([])
        expect(idsOf([], 'a')).toEqual([])
        expect(idsOf(items, 'zzz')).toEqual([])
    })
    it('stops at a missing ancestor', () => {
        expect(idsOf([note('c', 'child', 'b'), note('b', 'child', 'gone')], 'c')).toEqual(['b'])
    })
    it('stops at a cycle', () => {
        expect(idsOf([note('a', 'child', 'b'), note('b', 'child', 'a')], 'a')).toEqual(['b'])
    })
})
