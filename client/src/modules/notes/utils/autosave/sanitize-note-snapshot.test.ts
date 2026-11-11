import { describe, expect, it } from 'vitest'
import { removeUnsavableCharacters, sanitizeNoteSnapshot } from './sanitize-note-snapshot'

describe('removeUnsavableCharacters', () => {
    it('removes NUL and lone surrogate halves but keeps Thai text and real emoji pairs', () => {
        expect(removeUnsavableCharacters('a\u0000b')).toBe('ab')
        expect(removeUnsavableCharacters('x\uD83Dy')).toBe('xy')
        expect(removeUnsavableCharacters('x\uDE00y')).toBe('xy')
        expect(removeUnsavableCharacters('\uDE00\uD83D')).toBe('')
        expect(removeUnsavableCharacters('สวัสดี 😀')).toBe('สวัสดี 😀')
    })
})

describe('sanitizeNoteSnapshot', () => {
    it('cleans title, context and every string inside nested blocks, leaving other values alone', () => {
        const snapshot = sanitizeNoteSnapshot({
            title: 'T\u0000',
            context: '\uD800C',
            content: {
                schemaVersion: 1,
                blocks: [
                    {
                        id: 'b-1',
                        type: 'checklist',
                        text: 'a\u0000',
                        checked: true,
                        children: [{ id: 'b-2', type: 'paragraph', text: '\uDC00b' }],
                    },
                ],
            },
        })

        expect(snapshot).toEqual({
            title: 'T',
            context: 'C',
            content: {
                schemaVersion: 1,
                blocks: [
                    {
                        id: 'b-1',
                        type: 'checklist',
                        text: 'a',
                        checked: true,
                        children: [{ id: 'b-2', type: 'paragraph', text: 'b' }],
                    },
                ],
            },
        })
    })
})
