import { describe, expect, it } from 'vitest'
import type { NoteListItem, NotePlacement } from '../../types/note'
import { CANNOT_MOVE_INTO_SELF_REASON } from './note-placement'
import { dropRequest, dropZoneAt } from './note-drop'

function note(id: string, placement: NotePlacement, parentId: string | null = null, position = 0): NoteListItem {
    return { id, title: id, updatedAt: '2026-01-01T00:00:00Z', placement, parentId, position }
}

// r(root 1): a(1) with child g, b(2), x(3); o(root 2); u(unplaced) with child uc
const items = [
    note('r', 'root', null, 1),
    note('a', 'child', 'r', 1),
    note('b', 'child', 'r', 2),
    note('x', 'child', 'r', 3),
    note('g', 'child', 'a', 1),
    note('o', 'root', null, 2),
    note('u', 'unplaced'),
    note('uc', 'child', 'u', 1),
]
const refused = { ok: false, reason: CANNOT_MOVE_INTO_SELF_REASON }

describe('dropZoneAt', () => {
    it('splits a row into top, middle and bottom', () => {
        expect(dropZoneAt(0)).toBe('before')
        expect(dropZoneAt(0.24)).toBe('before')
        expect(dropZoneAt(0.5)).toBe('inside')
        expect(dropZoneAt(0.76)).toBe('after')
        expect(dropZoneAt(1)).toBe('after')
    })
})

describe('dropRequest', () => {
    it('inside makes the dragged note the last child of the target', () => {
        expect(dropRequest(items, 'o', 'b', 'inside')).toEqual({ ok: true, request: { placement: 'child', parentId: 'b' } })
        expect(dropRequest(items, 'a', 'o', 'inside')).toEqual({ ok: true, request: { placement: 'child', parentId: 'o' } })
    })
    it('before a child row puts it among that parent children, before the target', () => {
        expect(dropRequest(items, 'o', 'b', 'before')).toEqual({ ok: true, request: { placement: 'child', parentId: 'r', beforeId: 'b' } })
    })
    it('before a root row makes it a root note before that row', () => {
        expect(dropRequest(items, 'g', 'r', 'before')).toEqual({ ok: true, request: { placement: 'root', beforeId: 'r' } })
    })
    it('after a row goes before the next sibling', () => {
        expect(dropRequest(items, 'o', 'a', 'after')).toEqual({ ok: true, request: { placement: 'child', parentId: 'r', beforeId: 'b' } })
        expect(dropRequest(items, 'g', 'r', 'after')).toEqual({ ok: true, request: { placement: 'root', beforeId: 'o' } })
    })
    it('after the last sibling appends (no beforeId)', () => {
        expect(dropRequest(items, 'g', 'x', 'after')).toEqual({ ok: true, request: { placement: 'child', parentId: 'r' } })
        expect(dropRequest(items, 'g', 'o', 'after')).toEqual({ ok: true, request: { placement: 'root' } })
    })
    it('an unplaced note can be dropped into the tree', () => {
        expect(dropRequest(items, 'u', 'a', 'before')).toEqual({ ok: true, request: { placement: 'child', parentId: 'r', beforeId: 'a' } })
    })
    it('a top-level unplaced row only accepts inside, whatever the zone', () => {
        expect(dropRequest(items, 'o', 'u', 'before')).toEqual({ ok: true, request: { placement: 'child', parentId: 'u' } })
    })
    it('refuses itself and its descendants in every zone', () => {
        for (const zone of ['before', 'inside', 'after'] as const) {
            expect(dropRequest(items, 'r', 'r', zone)).toEqual(refused)
            expect(dropRequest(items, 'r', 'g', zone)).toEqual(refused)
            expect(dropRequest(items, 'a', 'g', zone)).toEqual(refused)
        }
    })
    it('does nothing when the note would stay where it is', () => {
        const noop = { ok: true, request: undefined }
        expect(dropRequest(items, 'x', 'r', 'inside')).toEqual(noop)
        expect(dropRequest(items, 'b', 'a', 'after')).toEqual(noop)
        expect(dropRequest(items, 'a', 'b', 'before')).toEqual(noop)
        expect(dropRequest(items, 'x', 'b', 'after')).toEqual(noop)
        expect(dropRequest(items, 'o', 'r', 'after')).toEqual(noop)
    })
    it('moves a note that is a child of the target but not the last one inside', () => {
        expect(dropRequest(items, 'a', 'r', 'inside')).toEqual({ ok: true, request: { placement: 'child', parentId: 'r' } })
    })
})
