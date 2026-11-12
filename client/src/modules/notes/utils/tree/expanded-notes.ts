import type { NoteListItem } from '../../types/note'
import { noteAncestors } from './note-ancestors'

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

export type ExpandedState = {
    expanded: Set<string>
    /** The list last looked at */
    items: NoteListItem[] | undefined
    /** The open note last looked at, found in the list or not */
    openNoteId: string | undefined
    /** The note whose path was opened; it stays closed after the user closes it, until another note is opened */
    pathFor: string | undefined
    /** The parent the open note had when its path was opened; a move to another parent opens the path again */
    pathParentId?: string | null
}

/**
 * Brings the state in line with a new list or a newly opened note: drops unknown ids and opens the path to the open note once per note and parent (a move re-opens it).
 * Returns the very same state when the list and the open note are the ones it already looked at, so calling it while
 * rendering settles (an open note that is not in the list yet, such as one just created, is tried again when the list changes)
 */
export function syncExpandedState(state: ExpandedState, items: NoteListItem[] | undefined, openNoteId: string | undefined): ExpandedState {
    if (!items || (state.items === items && state.openNoteId === openNoteId)) return state
    let expanded = pruneExpandedIds(state.expanded, items)
    let pathFor = state.pathFor
    let pathParentId = state.pathParentId
    const openNote = openNoteId === undefined ? undefined : items.find((item) => item.id === openNoteId)
    if (openNote && (pathFor !== openNote.id || pathParentId !== openNote.parentId)) {
        expanded = expandIds(expanded, noteAncestors(items, openNote.id).map((ancestor) => ancestor.id))
        pathFor = openNote.id
        pathParentId = openNote.parentId
    }
    return { expanded, items, openNoteId, pathFor, pathParentId }
}
