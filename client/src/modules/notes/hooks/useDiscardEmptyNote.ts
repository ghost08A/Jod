import { useEffect } from 'react'
import { discardEmptyNote } from '../services/note-service'
import type { NoteSnapshot } from '../utils/autosave/conflict-equivalence'
import { createDeferredActions } from '../utils/drafts/deferred-action'
import { leaveNewNote } from '../utils/drafts/leave-new-note'

const deferredDiscards = createDeferredActions()

/**
 * When the user leaves a note made by "New note" and nothing was written, asks the server to remove it.
 * The call waits one tick and a remount of the same note cancels it (React StrictMode unmounts once on purpose).
 */
export function useDiscardEmptyNote(
    noteId: string,
    readSavedState: () => { snapshot: NoteSnapshot; baseVersion: number } | undefined,
    refreshNoteList: () => void,
) {
    useEffect(() => {
        deferredDiscards.cancel(noteId)
        return () => {
            deferredDiscards.schedule(noteId, () => leaveNewNote(noteId, readSavedState, discardEmptyNote, refreshNoteList))
        }
    }, [noteId, readSavedState, refreshNoteList])
}
