import { describe, expect, it } from 'vitest'
import type { NoteListItem } from '../../types/note'
import {
    expandIds,
    parseExpandedIds,
    pruneExpandedIds,
    serializeExpandedIds,
    syncExpandedState,
    toggleExpandedId,
    type ExpandedState,
} from './expanded-notes'

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

describe('syncExpandedState', () => {
    const child = (id: string, parentId: string): NoteListItem => ({ ...item(id), placement: 'child', parentId })
    const start = (): ExpandedState => ({ expanded: new Set(), items: undefined, openNoteId: undefined, pathFor: undefined })

    it('does nothing while the list is not loaded', () => {
        const state = start()
        expect(syncExpandedState(state, undefined, 'a')).toBe(state)
    })
    it('opens the path to the open note once the list has it, and then settles (the same state comes back)', () => {
        const items = [item('p'), child('c', 'p')]
        const synced = syncExpandedState(start(), items, 'c')
        expect(synced.expanded).toEqual(new Set(['p']))
        expect(syncExpandedState(synced, items, 'c')).toBe(synced)
    })
    it('settles when the open note is not in the list yet (just created), and tries again when the list changes', () => {
        const before = [item('p')]
        const waiting = syncExpandedState(start(), before, 'c')
        expect(waiting.expanded.size).toBe(0)
        expect(syncExpandedState(waiting, before, 'c')).toBe(waiting)
        const after = [item('p'), child('c', 'p')]
        expect(syncExpandedState(waiting, after, 'c').expanded).toEqual(new Set(['p']))
    })
    it('does not open a branch again after the user closed it, while the same note stays open', () => {
        const items = [item('p'), child('c', 'p')]
        const opened = syncExpandedState(start(), items, 'c')
        const closed = { ...opened, expanded: new Set<string>() }
        expect(syncExpandedState(closed, items, 'c')).toBe(closed)
        expect(syncExpandedState(closed, [...items], 'c').expanded.size).toBe(0)
    })
    it('opens the path again when the open note gets another parent, then settles, and keeps a closed branch closed after that', () => {
        const before = [item('p'), item('q'), child('c', 'p')]
        const opened = syncExpandedState(start(), before, 'c')
        const moved = [item('p'), item('q'), child('c', 'q')]
        const reopened = syncExpandedState(opened, moved, 'c')
        expect(reopened.expanded).toEqual(new Set(['p', 'q']))
        expect(syncExpandedState(reopened, moved, 'c')).toBe(reopened)
        const closed = { ...reopened, expanded: new Set<string>() }
        expect(syncExpandedState(closed, [...moved], 'c').expanded.size).toBe(0)
    })
    it('drops remembered ids that are no longer in the list', () => {
        const state = { ...start(), expanded: new Set(['gone', 'p']) }
        expect(syncExpandedState(state, [item('p')], undefined).expanded).toEqual(new Set(['p']))
    })
})
