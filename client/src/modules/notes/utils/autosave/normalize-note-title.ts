export const DEFAULT_NOTE_TITLE = 'Untitled'

/** Trims surrounding whitespace and falls back to "Untitled" when blank, matching the server rule */
export function normalizeNoteTitle(rawTitle: string): string {
    const trimmed = rawTitle.trim()
    return trimmed.length > 0 ? trimmed : DEFAULT_NOTE_TITLE
}
