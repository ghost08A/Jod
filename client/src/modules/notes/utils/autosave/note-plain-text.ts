import type { NoteSnapshot } from './conflict-equivalence'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function blockLines(blocks: unknown, depth: number): string[] {
    if (!Array.isArray(blocks)) return []
    const lines: string[] = []
    let number = 0
    for (const block of blocks) {
        if (!isRecord(block)) continue
        const text = typeof block.text === 'string' ? block.text : ''
        number = block.type === 'numbered' ? number + 1 : 0
        let prefix = ''
        if (block.type === 'bullet' || block.type === 'toggle') prefix = '- '
        else if (block.type === 'numbered') prefix = `${number}. `
        else if (block.type === 'checklist') prefix = block.checked === true ? '[x] ' : '[ ] '
        else if (block.type === 'quote') prefix = '> '
        const line = block.type === 'divider' ? '---' : `${prefix}${text}`
        // Note: lines inside a code block keep their own indentation; only the first line gets the nesting indent
        lines.push(`${'  '.repeat(depth)}${line}`, ...blockLines(block.children, depth + 1))
    }
    return lines
}

/**
 * The note as plain text for the clipboard: title, context, then one line per block, nested blocks indented.
 * Reads the content without changing it, and copes with content it does not understand.
 */
export function noteToPlainText(snapshot: NoteSnapshot): string {
    const content = isRecord(snapshot.content) ? snapshot.content.blocks : undefined
    const header = snapshot.context ? [snapshot.title, snapshot.context] : [snapshot.title]
    return [...header, '', ...blockLines(content, 0)].join('\n')
}
