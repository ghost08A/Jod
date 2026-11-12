import { useEffect, useRef } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { deleteNotePermanently } from '../services/note-service'
import { useTrashMutation } from '../hooks/useTrashMutation'

type PermanentDeleteDialogProps = {
    noteId: string
    /** How many notes disappear: the note and its descendants of the same deletion still in Trash */
    count: number
    onClose: () => void
    /** Called after the delete worked; the caller closes the dialog */
    onDeleted: () => void
    /** Called when the server says the note is not in Trash anymore */
    onGone: () => void
}

/** A modal that asks before a delete for good. The native dialog traps focus, closes on Escape and returns focus */
export function PermanentDeleteDialog({ noteId, count, onClose, onDeleted, onGone }: PermanentDeleteDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const { run, isRunning, error } = useTrashMutation(() => deleteNotePermanently(noteId), onDeleted, onGone)

    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) dialog.showModal()
    }, [])

    return (
        <dialog
            ref={dialogRef}
            className="notes-conflict-dialog"
            aria-labelledby="notes-permanent-dialog-title"
            onClose={onClose}
            onCancel={(event) => isRunning && event.preventDefault()}
        >
            <h2 id="notes-permanent-dialog-title" className="notes-conflict-dialog-title">
                ลบถาวร
            </h2>
            <p>{count} โน้ตจะหายไปถาวร (โน้ตนี้และโน้ตย่อยที่ลบพร้อมกันและยังอยู่ใน Trash) กู้คืนไม่ได้</p>
            {error && <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />}
            <div className="notes-conflict-dialog-actions">
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={onClose} disabled={isRunning} autoFocus>
                    ยกเลิก
                </button>
                <button className="button-primary notes-conflict-button" type="button" onClick={run} disabled={isRunning || count === 0} aria-busy={isRunning}>
                    {isRunning && <span className="spinner" aria-hidden="true" />}
                    ลบถาวร
                </button>
            </div>
        </dialog>
    )
}
