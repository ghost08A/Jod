import { useEffect } from 'react'
import { discardEmptyNote } from '../services/note-service'
import type { NoteSnapshot } from '../utils/autosave/conflict-equivalence'
import { createDeferredActions } from '../utils/drafts/deferred-action'
import { forgetNewNoteDraft, isNewNoteDraft, isUntouchedNewNote } from '../utils/drafts/new-note-drafts'

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
            deferredDiscards.schedule(noteId, async () => {
                if (!isNewNoteDraft(noteId)) return
                const saved = readSavedState()
                if (!saved || !isUntouchedNewNote(saved.snapshot)) return
                try {
                    const { discarded } = await discardEmptyNote(noteId, saved.baseVersion)
                    forgetNewNoteDraft(noteId)
                    if (discarded) refreshNoteList()
                } catch {
                    // Note: offline or a server error: the empty note stays as an unplaced "Untitled", which the spec accepts
                }
            })
        }
    }, [noteId, readSavedState, refreshNoteList])
}
