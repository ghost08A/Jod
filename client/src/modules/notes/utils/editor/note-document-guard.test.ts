import { describe, expect, it } from 'vitest'
import { isEmptyNoteDocument, isNoteDocument, normalizeNoteDocument } from './note-document-guard'
import { noteDocumentToTipTap, tipTapToNoteDocument } from './tiptap-converter'

const validDocument = {
    schemaVersion: 1,
    blocks: [
        { id: 'p', type: 'paragraph', text: 'ย่อหน้า' },
        { id: 'h', type: 'heading', level: 3, text: 'หัวข้อ' },
        { id: 'q', type: 'quote', text: 'อ้างอิง' },
        { id: 'c1', type: 'code', text: 'x', language: 'sql' },
        { id: 'c2', type: 'code', text: 'y' },
        { id: 'd', type: 'divider' },
        {
            id: 'b',
            type: 'bullet',
            text: 'จุด',
            children: [
                { id: 'n', type: 'numbered', text: 'ลำดับ', children: [] },
                {
                    id: 't',
                    type: 'toggle',
                    text: '',
                    children: [{ id: 'k', type: 'checklist', text: 'งาน', checked: true, children: [] }],
                },
            ],
        },
    ],
}

describe('isNoteDocument', () => {
    it('accepts a document with every block type and nested children', () => {
        expect(isNoteDocument(validDocument)).toBe(true)
        expect(isNoteDocument({ schemaVersion: 1, blocks: [] })).toBe(true)
    })

    it('rejects content that is not a version 1 document with a block list', () => {
        expect(isNoteDocument(null)).toBe(false)
        expect(isNoteDocument('text')).toBe(false)
        expect(isNoteDocument([])).toBe(false)
        expect(isNoteDocument({ blocks: [] })).toBe(false)
        expect(isNoteDocument({ schemaVersion: 2, blocks: [] })).toBe(false)
        expect(isNoteDocument({ schemaVersion: 1, blocks: {} })).toBe(false)
    })

    it.each([
        ['an unknown type', { id: 'x', type: 'image', text: '' }],
        ['a missing id', { type: 'paragraph', text: '' }],
        ['an empty id', { id: '', type: 'paragraph', text: '' }],
        ['a missing text', { id: 'x', type: 'paragraph' }],
        ['a heading level 4', { id: 'x', type: 'heading', level: 4, text: '' }],
        ['a code language that is not text', { id: 'x', type: 'code', text: '', language: 5 }],
    ])('rejects a block with %s', (_, block) => {
        expect(isNoteDocument({ schemaVersion: 1, blocks: [block] })).toBe(false)
    })

    it('rejects a bad block deep inside children', () => {
        const deep = {
            schemaVersion: 1,
            blocks: [{ id: 'a', type: 'toggle', text: '', children: [{ id: 'b', type: 'bullet', text: '', children: [1] }] }],
        }
        expect(isNoteDocument(deep)).toBe(false)
    })
})

describe('isEmptyNoteDocument', () => {
    it('is true for no blocks or one empty paragraph', () => {
        expect(isEmptyNoteDocument({ schemaVersion: 1, blocks: [] })).toBe(true)
        expect(isEmptyNoteDocument({ schemaVersion: 1, blocks: [{ id: 'p', type: 'paragraph', text: '' }] })).toBe(true)
    })

    it('is false once anything is written or any other block exists', () => {
        expect(isEmptyNoteDocument({ schemaVersion: 1, blocks: [{ id: 'p', type: 'paragraph', text: 'ก' }] })).toBe(false)
        expect(isEmptyNoteDocument({ schemaVersion: 1, blocks: [{ id: 'd', type: 'divider' }] })).toBe(false)
        expect(
            isEmptyNoteDocument({
                schemaVersion: 1,
                blocks: [
                    { id: 'p1', type: 'paragraph', text: '' },
                    { id: 'p2', type: 'paragraph', text: '' },
                ],
            }),
        ).toBe(false)
        expect(
            isEmptyNoteDocument({ schemaVersion: 1, blocks: [{ id: 'b', type: 'bullet', text: '', children: [] }] }),
        ).toBe(false)
    })
})

describe('isNoteDocument follows the server contract', () => {
    it.each(['bullet', 'numbered', 'checklist', 'toggle'])('accepts a %s without children and fills in an empty list', (type) => {
        const content: unknown = { schemaVersion: 1, blocks: [{ id: 'x', type, text: 'ไม่มีลูก' }] }

        expect(isNoteDocument(content)).toBe(true)
        expect(normalizeNoteDocument(content)).toMatchObject({ blocks: [{ id: 'x', type, text: 'ไม่มีลูก', children: [] }] })
    })

    it('accepts a checklist without checked and treats it as not ticked, also deep inside children', () => {
        const content: unknown = {
            schemaVersion: 1,
            blocks: [{ id: 'a', type: 'toggle', text: '', children: [{ id: 'b', type: 'checklist', text: 'งาน' }] }],
        }

        expect(isNoteDocument(content)).toBe(true)
        expect(normalizeNoteDocument(content)).toEqual({
            schemaVersion: 1,
            blocks: [
                {
                    id: 'a',
                    type: 'toggle',
                    text: '',
                    children: [{ id: 'b', type: 'checklist', text: 'งาน', checked: false, children: [] }],
                },
            ],
        })
    })

    it('opens such a note and writes children and checked out explicitly after conversion', () => {
        const content: unknown = {
            schemaVersion: 1,
            blocks: [
                { id: 'c', type: 'checklist', text: 'งาน' },
                { id: 'b', type: 'bullet', text: 'จุด' },
            ],
        }
        const document = normalizeNoteDocument(content)
        if (!document) throw new Error('expected a valid document')

        expect(tipTapToNoteDocument(noteDocumentToTipTap(document))).toEqual({
            schemaVersion: 1,
            blocks: [
                { id: 'c', type: 'checklist', text: 'งาน', checked: false, children: [] },
                { id: 'b', type: 'bullet', text: 'จุด', children: [] },
            ],
        })
    })

    it.each([
        ['text that is not a string', { id: 'x', type: 'paragraph', text: 5 }],
        ['an id that is not a string', { id: 5, type: 'paragraph', text: '' }],
        ['checked that is not a boolean', { id: 'x', type: 'checklist', text: '', checked: 'true' }],
        ['children that is not a list', { id: 'x', type: 'toggle', text: '', children: {} }],
        ['a child that is not a block', { id: 'x', type: 'numbered', text: '', children: ['a'] }],
        ['an unknown block type', { id: 'x', type: 'callout', text: '' }],
        ['a heading level 4', { id: 'x', type: 'heading', level: 4, text: '' }],
        ['a heading without a level', { id: 'x', type: 'heading', text: '' }],
        ['children on a paragraph', { id: 'x', type: 'paragraph', text: '', children: [] }],
        ['children on a heading', { id: 'x', type: 'heading', level: 1, text: '', children: [] }],
        ['children on a quote', { id: 'x', type: 'quote', text: '', children: [] }],
        ['children on a code block', { id: 'x', type: 'code', text: '', children: [] }],
        ['children on a divider', { id: 'x', type: 'divider', children: [] }],
        ['checked on a bullet', { id: 'x', type: 'bullet', text: '', checked: true }],
        ['text on a divider', { id: 'x', type: 'divider', text: '' }],
        ['a missing text on a bullet', { id: 'x', type: 'bullet', children: [] }],
        ['a missing text on a quote', { id: 'x', type: 'quote' }],
    ])('still rejects a block with %s', (_, block) => {
        expect(isNoteDocument({ schemaVersion: 1, blocks: [block] })).toBe(false)
    })

    it('rejects a document with a property the server does not know', () => {
        expect(isNoteDocument({ schemaVersion: 1, blocks: [], extra: 1 })).toBe(false)
    })

    it('does not change content it rejects', () => {
        const content = {
            schemaVersion: 1,
            blocks: [
                { id: 'a', type: 'bullet', text: '' },
                { id: 'b', type: 'image', text: '' },
            ],
        }

        expect(isNoteDocument(content)).toBe(false)
        expect(content.blocks[0]).toEqual({ id: 'a', type: 'bullet', text: '' })
    })
})

describe('isNoteDocument does not change its input', () => {
    it('returns only a boolean and leaves omitted children and checked omitted', () => {
        const content = { schemaVersion: 1, blocks: [{ id: 'c', type: 'checklist', text: 'งาน' }] }
        const before = structuredClone(content)

        expect(isNoteDocument(content)).toBe(true)
        expect(content).toEqual(before)
        expect(isNoteDocument({ schemaVersion: 2, blocks: [] })).toBe(false)
    })
})

describe('normalizeNoteDocument', () => {
    it('returns a copy with the defaults filled and leaves the original untouched', () => {
        const content = { schemaVersion: 1, blocks: [{ id: 'a', type: 'toggle', text: '', children: [{ id: 'b', type: 'checklist', text: 'งาน' }] }] }
        const before = structuredClone(content)

        const result = normalizeNoteDocument(content)

        expect(result).not.toBe(content)
        expect(content).toEqual(before)
        expect(result).toEqual({
            schemaVersion: 1,
            blocks: [{ id: 'a', type: 'toggle', text: '', children: [{ id: 'b', type: 'checklist', text: 'งาน', checked: false, children: [] }] }],
        })
    })

    it('returns undefined when the value is not a valid document', () => {
        expect(normalizeNoteDocument(null)).toBeUndefined()
        expect(normalizeNoteDocument({ schemaVersion: 2, blocks: [] })).toBeUndefined()
        expect(normalizeNoteDocument({ schemaVersion: 1, blocks: [{ id: 'x', type: 'nope', text: '' }] })).toBeUndefined()
    })
})
