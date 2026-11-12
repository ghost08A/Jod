export type TextPart = { text: string; isMatch: boolean }

/** Cuts `text` into parts, marking where `query` occurs. Case-insensitive, the query is literal text (not a pattern) */
export function splitByMatch(text: string, query: string): TextPart[] {
    if (query.length === 0) return [{ text, isMatch: false }]
    // Note: the `u` flag makes the match work on whole characters, so a surrogate pair is never cut in half
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts: TextPart[] = []
    let cursor = 0
    for (const match of text.matchAll(new RegExp(escaped, 'giu'))) {
        if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), isMatch: false })
        parts.push({ text: match[0], isMatch: true })
        cursor = match.index + match[0].length
    }
    if (cursor < text.length) parts.push({ text: text.slice(cursor), isMatch: false })
    return parts.length > 0 ? parts : [{ text, isMatch: false }]
}
