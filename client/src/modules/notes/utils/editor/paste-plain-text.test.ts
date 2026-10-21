import { describe, expect, it } from 'vitest'
import { pastedTextToParagraphBlocks } from './paste-plain-text'

function makeSequentialIdGenerator() {
    let count = 0
    return () => {
        count += 1
        return `paste-id-${count}`
    }
}

describe('pastedTextToParagraphBlocks', () => {
    it('splits multi-line pasted text (with CRLF and LF) into plain-text paragraph blocks with unique ids', () => {
        const rawText = 'บรรทัดแรก ตัวหนา\r\nhttps://example.com/link\nบรรทัดที่สาม'

        const blocks = pastedTextToParagraphBlocks(rawText, makeSequentialIdGenerator())

        expect(blocks).toEqual([
            { id: 'paste-id-1', type: 'paragraph', text: 'บรรทัดแรก ตัวหนา' },
            { id: 'paste-id-2', type: 'paragraph', text: 'https://example.com/link' },
            { id: 'paste-id-3', type: 'paragraph', text: 'บรรทัดที่สาม' },
        ])
    })

    it('preserves empty lines between paragraphs when splitting multi-line pasted text', () => {
        const blocks = pastedTextToParagraphBlocks('ย่อหน้า 1\n\nย่อหน้า 2', makeSequentialIdGenerator())

        expect(blocks).toEqual([
            { id: 'paste-id-1', type: 'paragraph', text: 'ย่อหน้า 1' },
            { id: 'paste-id-2', type: 'paragraph', text: '' },
            { id: 'paste-id-3', type: 'paragraph', text: 'ย่อหน้า 2' },
        ])
    })

    it('returns an empty array when the pasted text is empty', () => {
        expect(pastedTextToParagraphBlocks('', makeSequentialIdGenerator())).toEqual([])
    })
})
