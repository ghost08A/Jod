import type { NoteListItem } from '../../types/note'

export const EXPANDED_NOTES_STORAGE_KEY = 'jod.notes.expanded'

/** Reads the remembered ids; anything that is not a JSON array of strings gives an empty set */
export function parseExpandedIds(raw: string | null): Set<string> {
    if (!raw) return new Set()
    try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return new Set()
        return new Set(parsed.filter((value): value is string => typeof value === 'string'))
    } catch {
        return new Set()
    }
}

export function serializeExpandedIds(expanded: Set<string>): string {
    return JSON.stringify([...expanded])
}

/** Drops ids that are not in the list. Returns the same set when nothing was dropped */
export function pruneExpandedIds(expanded: Set<string>, items: NoteListItem[]): Set<string> {
    const ids = new Set(items.map((item) => item.id))
    const kept = new Set([...expanded].filter((id) => ids.has(id)))
    return kept.size === expanded.size ? expanded : kept
}

/** Adds the ids to the set. Returns the same set when all were already in it */
export function expandIds(expanded: Set<string>, ids: string[]): Set<string> {
    return ids.every((id) => expanded.has(id)) ? expanded : new Set([...expanded, ...ids])
}

export function toggleExpandedId(expanded: Set<string>, id: string): Set<string> {
    const next = new Set(expanded)
    if (!next.delete(id)) next.add(id)
    return next
}
