import { getSchema } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import type { NoteBlock, NoteDocument } from './block-document'
import { createNoteEditorExtensions } from './note-editor-extensions'
import { noteDocumentToTipTap, tipTapToNoteDocument } from './tiptap-converter'

const schema = getSchema(createNoteEditorExtensions())

const failOnNewId = () => {
    throw new Error('a block lost its id')
}

/** Jod document -> TipTap JSON -> real ProseMirror node (checked) -> JSON -> Jod document */
function roundTripThroughSchema(document: NoteDocument): NoteDocument {
    const node = Node.fromJSON(schema, noteDocumentToTipTap(document, failOnNewId))
    node.check()
    return tipTapToNoteDocument(node.toJSON(), failOnNewId)
}

/** Takes plain JSON on purpose: these are shapes the converter types would not allow */
function expectRejected(json: Record<string, unknown>) {
    expect(() => Node.fromJSON(schema, json).check()).toThrow()
}

function everyBlockType(prefix: string): NoteBlock[] {
    return [
        { id: `${prefix}-p`, type: 'paragraph', text: 'ย่อหน้า' },
        { id: `${prefix}-p-empty`, type: 'paragraph', text: '' },
        { id: `${prefix}-h1`, type: 'heading', level: 1, text: 'หัวข้อ 1' },
        { id: `${prefix}-h2`, type: 'heading', level: 2, text: 'หัวข้อ 2' },
        { id: `${prefix}-h3`, type: 'heading', level: 3, text: '' },
        { id: `${prefix}-b`, type: 'bullet', text: 'จุด', children: [] },
        { id: `${prefix}-n`, type: 'numbered', text: 'ลำดับ', children: [] },
        { id: `${prefix}-c0`, type: 'checklist', text: 'ยังไม่ทำ', checked: false, children: [] },
        { id: `${prefix}-c1`, type: 'checklist', text: 'ทำแล้ว', checked: true, children: [] },
        { id: `${prefix}-t`, type: 'toggle', text: 'พับได้', children: [] },
        { id: `${prefix}-t-empty`, type: 'toggle', text: '', children: [] },
        { id: `${prefix}-q`, type: 'quote', text: 'อ้างอิง' },
        { id: `${prefix}-code-lang`, type: 'code', text: 'SELECT 1;\nSELECT 2;', language: 'sql' },
        { id: `${prefix}-code`, type: 'code', text: 'no language' },
        { id: `${prefix}-d`, type: 'divider' },
    ]
}

/** Nests `levels` containers, cycling bullet -> numbered -> checklist -> toggle, with a leaf at the bottom */
function deepNesting(levels: number): NoteBlock {
    let block: NoteBlock = { id: 'deepest', type: 'code', text: 'ลึกสุด' }
    for (let level = levels; level >= 1; level -= 1) {
        const id = `level-${level}`
        const text = `ชั้น ${level}`
        switch (level % 4) {
            case 0:
                block = { id, type: 'bullet', text, children: [block] }
                break
            case 1:
                block = { id, type: 'numbered', text, children: [block] }
                break
            case 2:
                block = { id, type: 'checklist', text, checked: level % 3 === 0, children: [block] }
                break
            default:
                block = { id, type: 'toggle', text, children: [block] }
        }
    }
    return block
}

describe('the converter against the real TipTap schema', () => {
    it('round-trips all 9 block types with every id unchanged', () => {
        const sample: NoteDocument = { schemaVersion: 1, blocks: everyBlockType('top') }

        expect(roundTripThroughSchema(sample)).toEqual(sample)
    })

    it('round-trips every block type as a child of bullet, numbered, checklist and toggle', () => {
        const sample: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'bullet', type: 'bullet', text: 'แม่', children: everyBlockType('in-bullet') },
                { id: 'numbered', type: 'numbered', text: 'แม่', children: everyBlockType('in-numbered') },
                {
                    id: 'checklist',
                    type: 'checklist',
                    text: 'แม่',
                    checked: true,
                    children: everyBlockType('in-checklist'),
                },
                { id: 'toggle', type: 'toggle', text: '', children: everyBlockType('in-toggle') },
            ],
        }

        expect(roundTripThroughSchema(sample)).toEqual(sample)
    })

    it('round-trips 32 levels of nesting through every container type', () => {
        const sample: NoteDocument = { schemaVersion: 1, blocks: [deepNesting(32)] }

        expect(roundTripThroughSchema(sample)).toEqual(sample)
    })

    it('turns an empty document into one empty paragraph with a new id, which comes back as a paragraph block', () => {
        const tipTap = noteDocumentToTipTap({ schemaVersion: 1, blocks: [] }, () => 'new-paragraph')
        const node = Node.fromJSON(schema, tipTap)
        node.check()

        expect(tipTapToNoteDocument(node.toJSON(), failOnNewId)).toEqual({
            schemaVersion: 1,
            blocks: [{ id: 'new-paragraph', type: 'paragraph', text: '' }],
        })
    })

    it('drops a toggle open state: the schema has no place to store it', () => {
        const node = Node.fromJSON(schema, {
            type: 'doc',
            content: [
                {
                    type: 'details',
                    attrs: { id: 't', open: true },
                    content: [{ type: 'detailsSummary' }, { type: 'detailsContent' }],
                },
            ],
        })

        expect(node.toJSON().content[0].attrs).toEqual({ id: 't' })
    })
})

describe('the schema is restricted to what a Jod document can hold', () => {
    const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

    it('has no marks at all, so text stays plain', () => {
        expect(Object.keys(schema.marks)).toEqual([])
        expectRejected({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'หนา', marks: [{ type: 'bold' }] }] }],
        })
    })

    it('rejects a line break inside a paragraph', () => {
        expectRejected({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'hardBreak' }] }] })
    })

    it('rejects a heading level 4', () => {
        expectRejected({ type: 'doc', content: [{ type: 'heading', attrs: { level: 4 }, content: [] }] })
    })

    it('rejects a quote that holds a list or two paragraphs', () => {
        const list = { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('a')] }] }
        expectRejected({ type: 'doc', content: [{ type: 'blockquote', content: [list] }] })
        expectRejected({ type: 'doc', content: [{ type: 'blockquote', content: [paragraph('a'), paragraph('b')] }] })
    })

    it('rejects a divider with children and a list item that does not start with its text', () => {
        expectRejected({ type: 'doc', content: [{ type: 'horizontalRule', content: [paragraph('a')] }] })
        expectRejected({
            type: 'doc',
            content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'horizontalRule' }] }] }],
        })
    })

    it('rejects an empty document', () => {
        expectRejected({ type: 'doc', content: [] })
    })

    it('puts the id attribute on block nodes only, not on the list wrappers', () => {
        const nodesWithId = Object.values(schema.nodes)
            .filter((nodeType) => nodeType.spec.attrs !== undefined && 'id' in nodeType.spec.attrs)
            .map((nodeType) => nodeType.name)
            .sort()

        expect(nodesWithId).toEqual(
            ['blockquote', 'codeBlock', 'details', 'heading', 'horizontalRule', 'listItem', 'paragraph', 'taskItem'].sort(),
        )
    })
})
