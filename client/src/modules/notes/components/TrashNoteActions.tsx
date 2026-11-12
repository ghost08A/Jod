import { useState } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useTrashMutation } from '../hooks/useTrashMutation'
import { restoreNote } from '../services/note-service'
import type { TrashNoteItem } from '../types/note'
import { permanentDeleteCount } from '../utils/tree/permanent-delete-count'
import { PermanentDeleteDialog } from './PermanentDeleteDialog'

type TrashNoteActionsProps = {
    noteId: string
    /** The Trash list, for the count in the confirm box; the delete button waits until it is loaded */
    items: TrashNoteItem[] | undefined
    onRestored: () => void
    onDeleted: () => void
    /** The server says the note is not in Trash anymore: refresh */
    onGone: () => void
}

/** "กู้คืน" and "ลบถาวร" for one trashed note */
export function TrashNoteActions({ noteId, items, onRestored, onDeleted, onGone }: TrashNoteActionsProps) {
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const { run, isRunning, error } = useTrashMutation(() => restoreNote(noteId), onRestored, onGone)

    return (
        <div className="notes-trash-actions">
            <button className="notes-secondary-button" type="button" onClick={run} disabled={isRunning} aria-busy={isRunning}>
                {isRunning && <span className="spinner" aria-hidden="true" />}
                กู้คืน
            </button>
            <button className="notes-secondary-button" type="button" onClick={() => setIsDeleteOpen(true)} disabled={isRunning || !items}>
                ลบถาวร
            </button>
            {error && <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />}
            {isDeleteOpen && items && (
                <PermanentDeleteDialog
                    noteId={noteId}
                    count={permanentDeleteCount(items, noteId)}
                    onClose={() => setIsDeleteOpen(false)}
                    onDeleted={() => {
                        setIsDeleteOpen(false)
                        onDeleted()
                    }}
                    onGone={onGone}
                />
            )}
        </div>
    )
}
