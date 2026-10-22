import { describe, expect, it } from 'vitest'
import {
    isConflictEquivalentToSaved,
    isStructurallyEqual,
    normalizeNoteSnapshot,
    type NoteSnapshot,
} from './conflict-equivalence'

describe('isStructurallyEqual', () => {
    it('treats nested objects with different key order as equal', () => {
        const first = {
            schemaVersion: 1,
            blocks: [
                {
                    id: 'b-1',
                    type: 'checklist',
                    checked: true,
                    text: 'Buy milk',
                    children: [{ id: 'b-2', type: 'paragraph', text: '2 bottles' }],
                },
            ],
        }
        const second = {
            blocks: [
                {
                    text: 'Buy milk',
                    checked: true,
                    children: [{ text: '2 bottles', id: 'b-2', type: 'paragraph' }],
                    type: 'checklist',
                    id: 'b-1',
                },
            ],
            schemaVersion: 1,
        }

        const equal = isStructurallyEqual(first, second)

        expect(equal).toBe(true)
    })

    it('returns false when block array order or nested values differ', () => {
        const first = {
            schemaVersion: 1,
            blocks: [
                { id: 'b-1', type: 'paragraph', text: 'First' },
                { id: 'b-2', type: 'paragraph', text: 'Second' },
            ],
        }
        const second = {
            schemaVersion: 1,
            blocks: [
                { id: 'b-2', type: 'paragraph', text: 'Second' },
                { id: 'b-1', type: 'paragraph', text: 'First' },
            ],
        }

        const equal = isStructurallyEqual(first, second)

        expect(equal).toBe(false)
    })
})

describe('isConflictEquivalentToSaved', () => {
    it('treats an empty sent title and a server "Untitled" title as equal when context and structure match', () => {
        const sentSnapshot: NoteSnapshot = {
            title: '   ',
            context: 'Sprint planning',
            content: {
                schemaVersion: 1,
                blocks: [{ id: 'block-1', type: 'paragraph', text: 'Hello' }],
            },
        }
        const serverCurrentNote: NoteSnapshot = {
            title: 'Untitled',
            context: 'Sprint planning',
            content: {
                blocks: [{ text: 'Hello', type: 'paragraph', id: 'block-1' }],
                schemaVersion: 1,
            },
        }

        const equivalent = isConflictEquivalentToSaved(sentSnapshot, serverCurrentNote)

        expect(equivalent).toBe(true)
    })

    it('returns false when the server note has different block content', () => {
        const sentSnapshot: NoteSnapshot = {
            title: 'Note A',
            context: '',
            content: {
                schemaVersion: 1,
                blocks: [{ id: 'block-1', type: 'paragraph', text: 'Mine' }],
            },
        }
        const serverCurrentNote: NoteSnapshot = {
            title: 'Note A',
            context: '',
            content: {
                schemaVersion: 1,
                blocks: [{ id: 'block-1', type: 'paragraph', text: 'Theirs' }],
            },
        }

        const equivalent = isConflictEquivalentToSaved(sentSnapshot, serverCurrentNote)

        expect(equivalent).toBe(false)
    })

    it('returns false when the context differs even if title and content match', () => {
        const sentSnapshot: NoteSnapshot = {
            title: 'Note A',
            context: 'Context 1',
            content: { schemaVersion: 1, blocks: [] },
        }
        const serverCurrentNote: NoteSnapshot = {
            title: 'Note A',
            context: 'Context 2',
            content: { schemaVersion: 1, blocks: [] },
        }

        const equivalent = isConflictEquivalentToSaved(sentSnapshot, serverCurrentNote)

        expect(equivalent).toBe(false)
    })

    it('normalizes snapshot title while keeping context and content intact', () => {
        const snapshot: NoteSnapshot = {
            title: '  ',
            context: 'Keep me',
            content: { schemaVersion: 1, blocks: [] },
        }

        const normalized = normalizeNoteSnapshot(snapshot)

        expect(normalized).toEqual({
            title: 'Untitled',
            context: 'Keep me',
            content: { schemaVersion: 1, blocks: [] },
        })
    })
})
