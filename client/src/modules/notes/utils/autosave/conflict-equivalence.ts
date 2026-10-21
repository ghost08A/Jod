import { normalizeNoteTitle } from './normalize-note-title'

export type NoteSnapshot = {
    title: string
    context: string
    content: unknown
}

export type ServerNoteVersion = NoteSnapshot & {
    version: number
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Compares two JSON-like values by structure rather than raw serialized key order */
export function isStructurallyEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) return false
        if (left.length !== right.length) return false
        for (let index = 0; index < left.length; index += 1) {
            if (!isStructurallyEqual(left[index], right[index])) return false
        }
        return true
    }

    if (isPlainRecord(left) && isPlainRecord(right)) {
        const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined)
        const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined)
        if (leftKeys.length !== rightKeys.length) return false

        for (const key of leftKeys) {
            if (!Object.prototype.hasOwnProperty.call(right, key)) return false
            if (!isStructurallyEqual(left[key], right[key])) return false
        }
        return true
    }

    return false
}

/** Returns a snapshot with its title normalized by the shared client/server rule */
export function normalizeNoteSnapshot(snapshot: NoteSnapshot): NoteSnapshot {
    return {
        title: normalizeNoteTitle(snapshot.title),
        context: snapshot.context,
        content: snapshot.content,
    }
}

/**
 * Decides whether a 409 Conflict actually reflects a previous save of the exact same snapshot
 * that succeeded on the server before the connection dropped.
 */
export function isConflictEquivalentToSaved(
    sentSnapshot: NoteSnapshot,
    serverCurrentNote: NoteSnapshot,
): boolean {
    const normalizedSentTitle = normalizeNoteTitle(sentSnapshot.title)
    const normalizedServerTitle = normalizeNoteTitle(serverCurrentNote.title)

    if (normalizedSentTitle !== normalizedServerTitle) return false
    if (sentSnapshot.context !== serverCurrentNote.context) return false
    return isStructurallyEqual(sentSnapshot.content, serverCurrentNote.content)
}
