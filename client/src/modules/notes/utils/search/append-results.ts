import type { NoteSearchResult } from '../../types/note'

/** Adds the next page after the results already shown; a note that is already shown is not added again */
export function appendResults(current: NoteSearchResult[], incoming: NoteSearchResult[]): NoteSearchResult[] {
    const shownIds = new Set(current.map((result) => result.id))
    return [...current, ...incoming.filter((result) => !shownIds.has(result.id))]
}
