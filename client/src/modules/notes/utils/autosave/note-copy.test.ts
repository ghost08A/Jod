import { describe, expect, it } from 'vitest'
import { findDuplicateBlockIds } from '../editor/block-id'
import { copyNoteWithNewBlockIds, NOTE_TITLE_MAX_CODE_POINTS } from './note-copy'

function sequentialIds() {
    let next = 0
    return () => `new-${next++}`
}

const nestedContent = {
    schemaVersion: 1,
    blocks: [
        {
            id: 'a',
            type: 'bullet',
            text: 'one',
            children: [{ id: 'b', type: 'checklist', text: 'two', checked: true, children: [{ id: 'c', type: 'paragraph', text: 'three' }] }],
        },
        { id: 'd', type: 'divider' },
    ],
}

describe('copyNoteWithNewBlockIds', () => {
    it('gives every block, nested ones included, a new unique id and keeps the rest', () => {
        const original = { title: 'Plan', context: 'ctx', content: nestedContent }
        const before = JSON.stringify(original)

        const copy = copyNoteWithNewBlockIds(original, sequentialIds())

        expect(JSON.stringify(original)).toBe(before)
        const blocks = (copy.content as typeof nestedContent).blocks
        expect(blocks[0]?.id).toBe('new-0')
        const child = (blocks[0] as { children: { id: string; checked: boolean; children: { id: string }[] }[] }).children[0]
        expect(child?.id).toBe('new-1')
        expect(child?.checked).toBe(true)
        expect(child?.children[0]?.id).toBe('new-2')
        expect(blocks[1]?.id).toBe('new-3')
        expect(findDuplicateBlockIds(copy.content as never)).toEqual([])
        expect(copy.context).toBe('ctx')
    })

    it('appends " (สำเนา)" to the title', () => {
        expect(copyNoteWithNewBlockIds({ title: 'Plan', context: '', content: nestedContent }).title).toBe('Plan (สำเนา)')
    })

    it('uses the normalized title, so a blank title becomes "Untitled (สำเนา)"', () => {
        expect(copyNoteWithNewBlockIds({ title: '  ', context: '', content: nestedContent }).title).toBe('Untitled (สำเนา)')
    })

    it('trims the original part so the result stays within the server limit counted in code points', () => {
        const longTitle = '😀'.repeat(NOTE_TITLE_MAX_CODE_POINTS)
        const { title } = copyNoteWithNewBlockIds({ title: longTitle, context: '', content: nestedContent })

        expect(Array.from(title)).toHaveLength(NOTE_TITLE_MAX_CODE_POINTS)
        expect(title.endsWith(' (สำเนา)')).toBe(true)
    })

    it('leaves content it does not understand as it is', () => {
        const content = { unknown: true }
        expect(copyNoteWithNewBlockIds({ title: 'x', context: '', content }).content).toBe(content)
    })
})
