import { describe, expect, it } from 'vitest'
import { forgetNewNoteDraft, isNewNoteDraft, isUntouchedNewNote, registerNewNoteDraft } from './new-note-drafts'

const emptyDocument = { schemaVersion: 1, blocks: [{ id: 'b', type: 'paragraph', text: '' }] }
const untouched = { title: 'Untitled', context: '', content: emptyDocument }

describe('new note drafts', () => {
    it('registers, finds and forgets an id', () => {
        expect(isNewNoteDraft('a')).toBe(false)
        registerNewNoteDraft('a')
        expect(isNewNoteDraft('a')).toBe(true)
        forgetNewNoteDraft('a')
        expect(isNewNoteDraft('a')).toBe(false)
    })
})

describe('isUntouchedNewNote', () => {
    it('accepts the default title, no context and an empty document', () => {
        expect(isUntouchedNewNote(untouched)).toBe(true)
        expect(isUntouchedNewNote({ ...untouched, title: '   ' })).toBe(true)
        expect(isUntouchedNewNote({ ...untouched, content: { schemaVersion: 1, blocks: [] } })).toBe(true)
    })

    it('rejects a changed title, a context or any content', () => {
        expect(isUntouchedNewNote({ ...untouched, title: 'Plan' })).toBe(false)
        expect(isUntouchedNewNote({ ...untouched, context: 'x' })).toBe(false)
        expect(isUntouchedNewNote({ ...untouched, content: { schemaVersion: 1, blocks: [{ id: 'b', type: 'paragraph', text: 'a' }] } })).toBe(false)
        expect(isUntouchedNewNote({ ...untouched, content: { schemaVersion: 1, blocks: [{ id: 'd', type: 'divider' }] } })).toBe(false)
    })

    it('rejects content that is not a note document', () => {
        expect(isUntouchedNewNote({ ...untouched, content: 'junk' })).toBe(false)
    })
})
