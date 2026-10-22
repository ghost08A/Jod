import { describe, expect, it } from 'vitest'
import type { NoteBlock, NoteDocument } from './block-document'
import { noteDocumentToTipTap, tipTapToNoteDocument, type TipTapDocument } from './tiptap-converter'

describe('noteDocumentToTipTap and tipTapToNoteDocument', () => {
    it('round-trips a document containing all 9 block types, heading levels 1-3, checked/unchecked checklist, and code with/without language', () => {
        const original: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'p-1', type: 'paragraph', text: 'ย่อหน้าธรรมดา' },
                { id: 'p-empty', type: 'paragraph', text: '' },
                { id: 'h-1', type: 'heading', level: 1, text: 'หัวข้อ 1' },
                { id: 'h-2', type: 'heading', level: 2, text: 'หัวข้อ 2' },
                { id: 'h-3', type: 'heading', level: 3, text: 'หัวข้อ 3' },
                { id: 'b-1', type: 'bullet', text: 'จุดที่ 1', children: [] },
                { id: 'b-2', type: 'bullet', text: 'จุดที่ 2', children: [] },
                { id: 'n-1', type: 'numbered', text: 'ข้อ 1', children: [] },
                { id: 'n-2', type: 'numbered', text: 'ข้อ 2', children: [] },
                { id: 'c-1', type: 'checklist', text: 'ยังไม่ทำ', checked: false, children: [] },
                { id: 'c-2', type: 'checklist', text: 'ทำเสร็จแล้ว', checked: true, children: [] },
                { id: 't-1', type: 'toggle', text: 'หัวข้อพับได้', children: [] },
                { id: 'q-1', type: 'quote', text: 'คำคมสำคัญ' },
                { id: 'code-lang', type: 'code', text: 'const x = 1', language: 'typescript' },
                { id: 'code-plain', type: 'code', text: 'plain code block' },
                { id: 'div-1', type: 'divider' },
            ],
        }

        const tipTap = noteDocumentToTipTap(original)
        const restored = tipTapToNoteDocument(tipTap, () => 'should-not-be-used')

        expect(restored).toEqual(original)
    })

    it('round-trips every allowed child block type inside bullet, numbered, checklist and toggle containers', () => {
        const sampleOfEveryBlockType = (prefix: string): NoteBlock[] => [
            { id: `${prefix}-p`, type: 'paragraph', text: 'ลูกย่อหน้า' },
            { id: `${prefix}-h1`, type: 'heading', level: 1, text: 'ลูกหัวข้อ 1' },
            { id: `${prefix}-h2`, type: 'heading', level: 2, text: 'ลูกหัวข้อ 2' },
            { id: `${prefix}-h3`, type: 'heading', level: 3, text: 'ลูกหัวข้อ 3' },
            { id: `${prefix}-b`, type: 'bullet', text: 'ลูกจุด', children: [] },
            { id: `${prefix}-n`, type: 'numbered', text: 'ลูกลำดับ', children: [] },
            { id: `${prefix}-c0`, type: 'checklist', text: 'ลูกเช็กยังไม่ติ๊ก', checked: false, children: [] },
            { id: `${prefix}-c1`, type: 'checklist', text: 'ลูกเช็กติ๊กแล้ว', checked: true, children: [] },
            { id: `${prefix}-t`, type: 'toggle', text: 'ลูกพับได้', children: [] },
            { id: `${prefix}-q`, type: 'quote', text: 'ลูกอ้างอิง' },
            { id: `${prefix}-code1`, type: 'code', text: 'SELECT 1;', language: 'sql' },
            { id: `${prefix}-code2`, type: 'code', text: 'no lang' },
            { id: `${prefix}-div`, type: 'divider' },
        ]

        const original: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                {
                    id: 'parent-bullet',
                    type: 'bullet',
                    text: 'แม่แบบจุด',
                    children: sampleOfEveryBlockType('in-bullet'),
                },
                {
                    id: 'parent-numbered',
                    type: 'numbered',
                    text: 'แม่แบบลำดับ',
                    children: sampleOfEveryBlockType('in-numbered'),
                },
                {
                    id: 'parent-checklist',
                    type: 'checklist',
                    text: 'แม่แบบเช็ก',
                    checked: true,
                    children: sampleOfEveryBlockType('in-checklist'),
                },
                {
                    id: 'parent-toggle',
                    type: 'toggle',
                    text: 'แม่แบบพับ',
                    children: sampleOfEveryBlockType('in-toggle'),
                },
            ],
        }

        const roundTripped = tipTapToNoteDocument(noteDocumentToTipTap(original))

        expect(roundTripped).toEqual(original)
    })

    it('round-trips deeply nested containers across many levels and preserves every id across multiple save cycles', () => {
        const original: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                {
                    id: 'level-1-toggle',
                    type: 'toggle',
                    text: 'ระดับ 1',
                    children: [
                        {
                            id: 'level-2-bullet',
                            type: 'bullet',
                            text: 'ระดับ 2',
                            children: [
                                {
                                    id: 'level-3-numbered',
                                    type: 'numbered',
                                    text: 'ระดับ 3',
                                    children: [
                                        {
                                            id: 'level-4-checklist',
                                            type: 'checklist',
                                            text: 'ระดับ 4',
                                            checked: true,
                                            children: [
                                                {
                                                    id: 'level-5-toggle',
                                                    type: 'toggle',
                                                    text: 'ระดับ 5',
                                                    children: [
                                                        {
                                                            id: 'level-6-code',
                                                            type: 'code',
                                                            text: 'console.log("deep")',
                                                            language: 'javascript',
                                                        },
                                                        {
                                                            id: 'level-6-divider',
                                                            type: 'divider',
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        let current = original
        for (let cycle = 0; cycle < 5; cycle += 1) {
            const tipTap = noteDocumentToTipTap(current)
            current = tipTapToNoteDocument(tipTap, () => `unexpected-${cycle}`)
        }

        expect(current).toEqual(original)
    })

    it('does not persist toggle open/closed UI state when converting from TipTap details nodes', () => {
        const tipTapWithOpenState: TipTapDocument = {
            type: 'doc',
            content: [
                {
                    type: 'details',
                    attrs: { id: 'toggle-1', open: true },
                    content: [
                        { type: 'detailsSummary', content: [{ type: 'text', text: 'หัวข้อ Toggle' }] },
                        {
                            type: 'detailsContent',
                            content: [
                                {
                                    type: 'paragraph',
                                    attrs: { id: 'child-p' },
                                    content: [{ type: 'text', text: 'เนื้อหาข้างใน' }],
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        const document = tipTapToNoteDocument(tipTapWithOpenState)
        const toggleBlock = document.blocks[0]

        expect(toggleBlock).toEqual({
            id: 'toggle-1',
            type: 'toggle',
            text: 'หัวข้อ Toggle',
            children: [{ id: 'child-p', type: 'paragraph', text: 'เนื้อหาข้างใน' }],
        })
        expect('open' in (toggleBlock ?? {})).toBe(false)
        const reserialized = noteDocumentToTipTap(document)
        expect(reserialized.content[0]?.attrs).toEqual({ id: 'toggle-1' })
    })

    it('generates a stable block id when a newly created TipTap node does not have an id yet', () => {
        const tipTapWithoutIds: TipTapDocument = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'บล็อกใหม่' }],
                },
                {
                    type: 'taskList',
                    content: [
                        {
                            type: 'taskItem',
                            attrs: { checked: false },
                            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'งานใหม่' }] }],
                        },
                    ],
                },
            ],
        }
        let counter = 0
        const generateId = () => {
            counter += 1
            return `generated-${counter}`
        }

        const document = tipTapToNoteDocument(tipTapWithoutIds, generateId)

        expect(document.blocks[0]?.id).toBe('generated-1')
        expect(document.blocks[1]?.id).toBe('generated-2')
    })
})
