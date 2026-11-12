import { useEffect, useRef } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useDeleteNote } from '../hooks/useDeleteNote'
import type { DeleteScope, NoteListItem } from '../types/note'
import { branchDeleteCount } from '../utils/tree/note-placement'

type DeleteNoteDialogProps = {
    noteId: string
    /** The note list the sidebar loaded; the count of notes comes from it */
    items: NoteListItem[]
    onClose: () => void
    /** Called after the delete worked. The dialog does not close itself; the caller leaves the page */
    onDeleted: () => void
}

/** A modal that asks how to delete. The native dialog traps focus, closes on Escape and returns focus */
export function DeleteNoteDialog({ noteId, items, onClose, onDeleted }: DeleteNoteDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const { remove, deletingScope, isDeleting, error } = useDeleteNote(noteId, onDeleted)
    const branchCount = branchDeleteCount(items, noteId)
    const hasChildren = branchCount > 1

    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) dialog.showModal()
    }, [])

    return (
        <dialog
            ref={dialogRef}
            className="notes-conflict-dialog"
            aria-labelledby="notes-delete-dialog-title"
            onClose={onClose}
            onCancel={(event) => isDeleting && event.preventDefault()}
        >
            <h2 id="notes-delete-dialog-title" className="notes-conflict-dialog-title">
                ลบโน้ตนี้
            </h2>
            <p>
                {hasChildren
                    ? 'เลือกว่าจะลบแค่ไหน โน้ตที่ลบจะไปอยู่ใน Trash และกู้คืนได้ภายหลัง'
                    : 'โน้ตนี้จะไปอยู่ใน Trash และกู้คืนได้ภายหลัง'}
            </p>
            {error && <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />}
            <div className="notes-delete-choices" aria-busy={isDeleting}>
                <ChoiceButton scope="branch" deletingScope={deletingScope} onPick={remove} isPrimary>
                    {hasChildren ? 'ลบทั้งกิ่ง' : 'ลบโน้ตนี้'}
                </ChoiceButton>
                {hasChildren && (
                    <>
                        <p className="notes-move-hint">โน้ตนี้และโน้ตย่อยทั้งหมด รวม {branchCount} โน้ต จะไปอยู่ใน Trash</p>
                        <ChoiceButton scope="single" deletingScope={deletingScope} onPick={remove}>
                            ลบเฉพาะโน้ตนี้
                        </ChoiceButton>
                        <p className="notes-move-hint">เฉพาะโน้ตนี้ไปอยู่ใน Trash โน้ตย่อยจะย้ายขึ้นไปอยู่ที่ที่โน้ตนี้เคยอยู่</p>
                    </>
                )}
            </div>
            <div className="notes-conflict-dialog-actions">
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={onClose} disabled={isDeleting}>
                    ยกเลิก
                </button>
            </div>
        </dialog>
    )
}

type ChoiceButtonProps = {
    scope: DeleteScope
    deletingScope: DeleteScope | undefined
    onPick: (scope: DeleteScope) => void
    isPrimary?: boolean
    children: string
}

function ChoiceButton({ scope, deletingScope, onPick, isPrimary = false, children }: ChoiceButtonProps) {
    return (
        <button
            className={`${isPrimary ? 'button-primary' : 'notes-secondary-button'} notes-conflict-button`}
            type="button"
            disabled={deletingScope !== undefined}
            onClick={() => onPick(scope)}
        >
            {deletingScope === scope && <span className="spinner" aria-hidden="true" />}
            {children}
        </button>
    )
}
