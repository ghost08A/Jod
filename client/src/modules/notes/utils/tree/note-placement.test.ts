import { describe, expect, it } from 'vitest'
import type { NoteListItem, NotePlacement } from '../../types/note'
import { buildNoteTree } from './build-note-tree'
import { branchDeleteCount, canMoveInto, CANNOT_MOVE_INTO_SELF_REASON, compareSiblings, noteDescendantIds, siblingMoveRequest, siblingsOf } from './note-placement'

function note(id: string, placement: NotePlacement, parentId: string | null = null, position = 0): NoteListItem {
    return { id, title: id, updatedAt: '2026-01-01T00:00:00Z', placement, parentId, position }
}

const family = [note('r', 'root', null, 1), note('a', 'child', 'r', 1), note('b', 'child', 'r', 2), note('g', 'child', 'a', 1), note('x', 'child', 'r', 3), note('o', 'root', null, 2)]

describe('noteDescendantIds', () => {
    it('finds children at every depth and not the note itself', () => {
        expect(noteDescendantIds(family, 'r')).toEqual(new Set(['a', 'b', 'g', 'x']))
        expect(noteDescendantIds(family, 'g').size).toBe(0)
    })
    it('does not loop on a cycle', () => {
        const cycle = [note('a', 'child', 'b'), note('b', 'child', 'a')]
        expect(noteDescendantIds(cycle, 'a')).toEqual(new Set(['b']))
    })
})

describe('canMoveInto', () => {
    it('refuses itself and its descendants with the reason', () => {
        const refused = { ok: false, reason: CANNOT_MOVE_INTO_SELF_REASON }
        expect(canMoveInto(family, 'r', 'r')).toEqual(refused)
        expect(canMoveInto(family, 'r', 'g')).toEqual(refused)
    })
    it('allows other notes, a parent below its own child, and the current parent', () => {
        expect(canMoveInto(family, 'a', 'o')).toEqual({ ok: true })
        expect(canMoveInto(family, 'g', 'r')).toEqual({ ok: true })
        expect(canMoveInto(family, 'a', 'r')).toEqual({ ok: true })
    })
})

describe('siblingsOf', () => {
    it('keeps to the same placement and parent, in position order, ties by id', () => {
        const items = [note('z', 'child', 'p', 1), note('c', 'child', 'p', 2), note('m', 'child', 'q', 0), note('a', 'child', 'p', 1), note('p', 'root')]
        expect(siblingsOf(items, 'c').map((item) => item.id)).toEqual(['a', 'z', 'c'])
        expect(siblingsOf(family, 'o').map((item) => item.id)).toEqual(['r', 'o'])
    })
    it('has none for an unplaced note or an unknown one', () => {
        expect(siblingsOf([note('u', 'unplaced')], 'u')).toEqual([])
        expect(siblingsOf(family, 'nope')).toEqual([])
    })
    it('orders like buildNoteTree, also on equal positions', () => {
        const items = [note('p', 'root'), note('b', 'child', 'p', 1), note('a', 'child', 'p', 1), note('c', 'child', 'p', 0)]
        expect(siblingsOf(items, 'a').map((item) => item.id)).toEqual(buildNoteTree(items).root[0].children.map((branch) => branch.item.id))
        expect([note('b', 'root'), note('a', 'root')].sort(compareSiblings).map((item) => item.id)).toEqual(['a', 'b'])
    })
})

describe('siblingMoveRequest', () => {
    it('moves up before the previous sibling', () => {
        expect(siblingMoveRequest(family, 'b', 'up')).toEqual({ placement: 'child', parentId: 'r', beforeId: 'a' })
        expect(siblingMoveRequest(family, 'x', 'up')).toEqual({ placement: 'child', parentId: 'r', beforeId: 'b' })
    })
    it('moves down before the sibling after the next one, or last when the next one is the last', () => {
        expect(siblingMoveRequest(family, 'a', 'down')).toEqual({ placement: 'child', parentId: 'r', beforeId: 'x' })
        expect(siblingMoveRequest(family, 'b', 'down')).toEqual({ placement: 'child', parentId: 'r', beforeId: undefined })
    })
    it('is undefined at the ends', () => {
        expect(siblingMoveRequest(family, 'a', 'up')).toBeUndefined()
        expect(siblingMoveRequest(family, 'x', 'down')).toBeUndefined()
    })
    it('works among root notes without a parent', () => {
        expect(siblingMoveRequest(family, 'o', 'up')).toEqual({ placement: 'root', beforeId: 'r' })
        expect(siblingMoveRequest(family, 'r', 'down')).toEqual({ placement: 'root', beforeId: undefined })
    })
    it('is undefined for an unplaced or unknown note', () => {
        expect(siblingMoveRequest([note('u', 'unplaced')], 'u', 'up')).toBeUndefined()
        expect(siblingMoveRequest(family, 'nope', 'down')).toBeUndefined()
    })
})

describe('branchDeleteCount', () => {
    it('counts the note and every note below it', () => {
        expect(branchDeleteCount(family, 'r')).toBe(5)
        expect(branchDeleteCount(family, 'a')).toBe(2)
    })
    it('is 1 for a note without children and 0 for an unknown note', () => {
        expect(branchDeleteCount(family, 'g')).toBe(1)
        expect(branchDeleteCount(family, 'nope')).toBe(0)
    })
})
