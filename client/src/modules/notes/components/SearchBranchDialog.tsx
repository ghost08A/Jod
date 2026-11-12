import { useEffect, useRef } from 'react'
import type { NoteListItem } from '../types/note'
import { MoveTargetTree } from './MoveTargetTree'

type SearchBranchDialogProps = {
    items: NoteListItem[]
    onPick: (parentId: string) => void
    onClose: () => void
}

/** A modal to choose the note whose branch (the note and everything under it) the search is limited to */
export function SearchBranchDialog({ items, onPick, onClose }: SearchBranchDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) dialog.showModal()
    }, [])

    return (
        <dialog ref={dialogRef} className="notes-conflict-dialog notes-move-dialog" aria-labelledby="notes-search-branch-title" onClose={onClose}>
            <h2 id="notes-search-branch-title" className="notes-conflict-dialog-title">
                ค้นเฉพาะในกิ่ง
            </h2>
            {items.length === 0 ? (
                <p>ยังไม่มีโน้ตให้เลือก</p>
            ) : (
                <MoveTargetTree items={items} isMoving={false} pickLabel="เลือกกิ่งนี้" onPick={onPick} />
            )}
            <div className="notes-conflict-dialog-actions">
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={onClose} autoFocus>
                    ปิด
                </button>
            </div>
        </dialog>
    )
}
