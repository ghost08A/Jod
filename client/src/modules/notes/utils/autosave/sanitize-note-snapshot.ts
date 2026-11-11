import type { NoteSnapshot } from './conflict-equivalence'

// Note: half of a surrogate pair with no partner. It is not a real character, and the server cannot store it
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/** Removes the characters PostgreSQL cannot store (NUL and broken surrogate halves), so the server does not answer 400 */
export function removeUnsavableCharacters(text: string): string {
    return text.replaceAll('\u0000', '').replace(LONE_SURROGATE, '')
}

function sanitizeJsonValue(value: unknown): unknown {
    if (typeof value === 'string') return removeUnsavableCharacters(value)
    if (Array.isArray(value)) return value.map(sanitizeJsonValue)
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item)]))
    }
    return value
}

/** The snapshot that is both sent and compared, so "saved" means the server holds exactly what was checked */
export function sanitizeNoteSnapshot(snapshot: NoteSnapshot): NoteSnapshot {
    return {
        title: removeUnsavableCharacters(snapshot.title),
        context: removeUnsavableCharacters(snapshot.context),
        content: sanitizeJsonValue(snapshot.content),
    }
}
