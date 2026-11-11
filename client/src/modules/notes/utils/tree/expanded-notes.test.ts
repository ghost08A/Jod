import { describe, expect, it } from 'vitest'
import type { NoteListItem } from '../../types/note'
import { expandIds, parseExpandedIds, pruneExpandedIds, serializeExpandedIds, toggleExpandedId } from './expanded-notes'

const item = (id: string): NoteListItem => ({ id, title: id, updatedAt: '', placement: 'unplaced', parentId: null, position: 0 })

describe('expanded notes', () => {
    it('round-trips through JSON', () => {
        expect(parseExpandedIds(serializeExpandedIds(new Set(['a', 'b'])))).toEqual(new Set(['a', 'b']))
    })
    it('gives an empty set for missing, broken or wrong-shaped data and ignores non-strings', () => {
        expect(parseExpandedIds(null).size).toBe(0)
        expect(parseExpandedIds('{oops').size).toBe(0)
        expect(parseExpandedIds('{"a":1}').size).toBe(0)
        expect(parseExpandedIds('["a",1,null]')).toEqual(new Set(['a']))
    })
    it('prunes ids that are not in the list, and keeps the same set when nothing is dropped', () => {
        const expanded = new Set(['a', 'gone'])
        expect(pruneExpandedIds(expanded, [item('a')])).toEqual(new Set(['a']))
        const clean = new Set(['a'])
        expect(pruneExpandedIds(clean, [item('a')])).toBe(clean)
    })
    it('expands ids without changing the original, and returns the same set when already expanded', () => {
        const expanded = new Set(['a'])
        expect(expandIds(expanded, ['a', 'b'])).toEqual(new Set(['a', 'b']))
        expect(expanded.size).toBe(1)
        expect(expandIds(expanded, ['a'])).toBe(expanded)
    })
    it('toggles', () => {
        expect(toggleExpandedId(new Set(), 'a')).toEqual(new Set(['a']))
        expect(toggleExpandedId(new Set(['a']), 'a').size).toBe(0)
    })
})
