import type { ParagraphBlock } from './block-document'
import { defaultGenerateBlockId, type IdGenerator } from './block-id'

/**
 * Splits external pasted plain text (which may have came from rich text with bold, links,
 * or multiple lines) into plain-text Paragraph blocks, one block per line.
 */
export function pastedTextToParagraphBlocks(
    pastedPlainText: string,
    generateId: IdGenerator = defaultGenerateBlockId,
): ParagraphBlock[] {
    const normalized = pastedPlainText.replace(/\r\n?/g, '\n')
    if (normalized.length === 0) {
        return []
    }

    const lines = normalized.split('\n')
    return lines.map((line) => ({
        id: generateId(),
        type: 'paragraph',
        text: line,
    }))
}
