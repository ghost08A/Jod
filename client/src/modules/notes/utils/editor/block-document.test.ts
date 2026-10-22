import { describe, expect, it } from 'vitest'
import { createEmptyNoteDocument, isContainerBlock, type NoteBlock } from './block-document'

describe('createEmptyNoteDocument', () => {
    it('creates a schemaVersion 1 document with one empty paragraph using the injected id generator', () => {
        const document = createEmptyNoteDocument(() => '00000000-0000-4000-8000-000000000001')

        expect(document).toEqual({
            schemaVersion: 1,
            blocks: [
                {
                    id: '00000000-0000-4000-8000-000000000001',
                    type: 'paragraph',
                    text: '',
                },
            ],
        })
    })
})

describe('isContainerBlock', () => {
    it('returns true only for bullet, numbered, checklist and toggle blocks', () => {
        const containerBlocks: NoteBlock[] = [
            { id: '1', type: 'bullet', text: 'a', children: [] },
            { id: '2', type: 'numbered', text: 'b', children: [] },
            { id: '3', type: 'checklist', text: 'c', checked: false, children: [] },
            { id: '4', type: 'toggle', text: 'd', children: [] },
        ]
        const leafBlocks: NoteBlock[] = [
            { id: '5', type: 'paragraph', text: 'e' },
            { id: '6', type: 'heading', level: 1, text: 'f' },
            { id: '7', type: 'quote', text: 'g' },
            { id: '8', type: 'code', text: 'h' },
            { id: '9', type: 'divider' },
        ]

        expect(containerBlocks.every((block) => isContainerBlock(block))).toBe(true)
        expect(leafBlocks.some((block) => isContainerBlock(block))).toBe(false)
    })
})
