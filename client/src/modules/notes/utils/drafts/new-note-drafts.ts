import type { NoteSnapshot } from '../autosave/conflict-equivalence'
import { DEFAULT_NOTE_TITLE, normalizeNoteTitle } from '../autosave/normalize-note-title'
import { isEmptyNoteDocument, isNoteDocument } from '../editor/note-document-guard'

// Note: memory of this tab only. The ids are not note text, but nothing is kept across a reload on purpose (no background cleanup)
const draftIds = new Set<string>()

/** Remembers a note made by the "New note" button */
export function registerNewNoteDraft(noteId: string): void {
    draftIds.add(noteId)
}

export function forgetNewNoteDraft(noteId: string): void {
    draftIds.delete(noteId)
}

export function isNewNoteDraft(noteId: string): boolean {
    return draftIds.has(noteId)
}

/** True when nothing was written: default title, no context and an empty document */
export function isUntouchedNewNote(snapshot: NoteSnapshot): boolean {
    return (
        normalizeNoteTitle(snapshot.title) === DEFAULT_NOTE_TITLE &&
        snapshot.context === '' &&
        isNoteDocument(snapshot.content) &&
        isEmptyNoteDocument(snapshot.content)
    )
}
