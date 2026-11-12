import type { NoteSnapshot } from '../autosave/conflict-equivalence'
import { forgetNewNoteDraft, isNewNoteDraft, isUntouchedNewNote } from './new-note-drafts'

/**
 * What to do when the user leaves a note made by the "New note" button. Only a note that is still untouched is offered to
 * the server for removal; the server decides. Whatever happens the note stops being a draft, so a note that was written in
 * and erased later is never removed by this rule. A failed call is ignored: the empty note simply stays (spec decision).
 */
export async function leaveNewNote(
    noteId: string,
    readSavedState: () => { snapshot: NoteSnapshot; baseVersion: number } | undefined,
    discard: (noteId: string, baseVersion: number) => Promise<{ discarded: boolean }>,
    onDiscarded: () => void,
): Promise<void> {
    if (!isNewNoteDraft(noteId)) return
    const saved = readSavedState()
    if (!saved || !isUntouchedNewNote(saved.snapshot)) {
        forgetNewNoteDraft(noteId)
        return
    }
    try {
        const { discarded } = await discard(noteId, saved.baseVersion)
        if (discarded) onDiscarded()
    } catch {
        // Note: offline or a server error, see above
    } finally {
        forgetNewNoteDraft(noteId)
    }
}
