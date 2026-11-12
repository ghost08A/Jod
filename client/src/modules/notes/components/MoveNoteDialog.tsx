import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useMoveNote } from '../hooks/useMoveNote'
import type { NoteListItem } from '../types/note'
import { siblingMoveRequest } from '../utils/tree/note-placement'
import { MoveTargetTree } from './MoveTargetTree'

type MoveNoteDialogProps = {
    noteId: string
    /** The note list the sidebar loaded */
    items: NoteListItem[]
    onClose: () => void
    /** Called after a move worked; the list should refresh. The dialog then closes */
    onMoved: () => void
}

/** A modal with the ways to place a note. The native dialog traps focus, closes on Escape and returns focus */
export function MoveNoteDialog({ noteId, items, onClose, onMoved }: MoveNoteDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [isPicking, setIsPicking] = useState(false)
    const { move, isMoving, error, clearError } = useMoveNote(noteId, () => {
        onMoved()
        onClose()
    })
    const note = items.find((item) => item.id === noteId)
    const up = siblingMoveRequest(items, noteId, 'up')
    const down = siblingMoveRequest(items, noteId, 'down')

    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) dialog.showModal()
    }, [])

    function showPicker(value: boolean) {
        clearError()
        setIsPicking(value)
    }

    return (
        <dialog ref={dialogRef} className="notes-conflict-dialog notes-move-dialog" aria-labelledby="notes-move-dialog-title" onClose={onClose}>
            <h2 id="notes-move-dialog-title" className="notes-conflict-dialog-title">
                {isPicking ? 'ย้ายไปที่…' : 'จัดวาง'}
            </h2>
            {error && <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />}
            {!note ? (
                <p>ไม่พบโน้ตนี้ในรายการ ลองปิดแล้วเปิดใหม่</p>
            ) : isPicking ? (
                <>
                    <button className="notes-secondary-button notes-conflict-button" type="button" onClick={() => showPicker(false)} disabled={isMoving}>
                        กลับ
                    </button>
                    <MoveTargetTree items={items} noteId={noteId} isMoving={isMoving} onPick={(parentId) => move({ placement: 'child', parentId })} />
                </>
            ) : (
                <div className="notes-move-actions" aria-busy={isMoving}>
                    <ActionButton
                        id="root"
                        isBusy={isMoving}
                        disabled={note.placement === 'root'}
                        hint={note.placement === 'root' ? 'เป็น Root note อยู่แล้ว' : undefined}
                        onClick={() => move({ placement: 'root' })}
                    >
                        เป็นแม่ใหม่ (Root note)
                    </ActionButton>
                    <ActionButton
                        id="unplaced"
                        isBusy={isMoving}
                        disabled={note.placement === 'unplaced'}
                        hint={note.placement === 'unplaced' ? 'ตอนนี้อยู่ที่นี่' : undefined}
                        onClick={() => move({ placement: 'unplaced' })}
                    >
                        ปล่อยไว้รอจัดวาง
                    </ActionButton>
                    <ActionButton id="pick" isBusy={isMoving} onClick={() => showPicker(true)}>
                        ย้ายไปที่…
                    </ActionButton>
                    {note.placement !== 'unplaced' && (
                        <>
                            <ActionButton id="up" isBusy={isMoving} disabled={!up} hint={up ? undefined : 'อยู่ลำดับแรกแล้ว'} onClick={() => up && move(up)}>
                                เลื่อนขึ้น
                            </ActionButton>
                            <ActionButton id="down" isBusy={isMoving} disabled={!down} hint={down ? undefined : 'อยู่ลำดับสุดท้ายแล้ว'} onClick={() => down && move(down)}>
                                เลื่อนลง
                            </ActionButton>
                        </>
                    )}
                </div>
            )}
            <div className="notes-conflict-dialog-actions">
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={onClose} autoFocus>
                    ปิด
                </button>
            </div>
        </dialog>
    )
}

type ActionButtonProps = {
    id: string
    children: ReactNode
    isBusy: boolean
    disabled?: boolean
    /** Why the button is off, or where the note is now; shown as text next to it */
    hint?: string
    onClick: () => void
}

function ActionButton({ id, children, isBusy, disabled = false, hint, onClick }: ActionButtonProps) {
    const hintId = `notes-move-action-${id}`
    return (
        <div className="notes-move-action">
            <button
                className="notes-secondary-button notes-conflict-button notes-move-action-button"
                type="button"
                disabled={disabled || isBusy}
                aria-describedby={hint ? hintId : undefined}
                onClick={onClick}
            >
                {isBusy && <span className="spinner" aria-hidden="true" />}
                {children}
            </button>
            {hint && (
                <span id={hintId} className="notes-move-hint">
                    {hint}
                </span>
            )}
        </div>
    )
}
