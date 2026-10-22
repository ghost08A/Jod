import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTE_TITLE, normalizeNoteTitle } from './normalize-note-title'

describe('normalizeNoteTitle', () => {
    it('returns the trimmed title when non-empty text is surrounded by spaces', () => {
        const rawTitle = '   Project roadmap   '

        const normalized = normalizeNoteTitle(rawTitle)

        expect(normalized).toBe('Project roadmap')
    })

    it('returns "Untitled" when the title is empty', () => {
        const rawTitle = ''

        const normalized = normalizeNoteTitle(rawTitle)

        expect(normalized).toBe(DEFAULT_NOTE_TITLE)
    })

    it('returns "Untitled" when the title contains only whitespace characters', () => {
        const rawTitle = '   \t\n  '

        const normalized = normalizeNoteTitle(rawTitle)

        expect(normalized).toBe('Untitled')
    })

    it('preserves internal whitespace inside a valid title', () => {
        const rawTitle = '  Meeting   notes  '

        const normalized = normalizeNoteTitle(rawTitle)

        expect(normalized).toBe('Meeting   notes')
    })
})
