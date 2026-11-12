import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { createNote } from '../services/note-service'
import { registerNewNoteDraft } from '../utils/drafts/new-note-drafts'
import { buildNotePath } from '../utils/shell/note-path'

type NewNoteButtonProps = {
    /** Called after the note exists and its page is open, so the list can refresh */
    onCreated: () => void
    /** Makes the new note a child of this note (the "add a child note" button) */
    parentId?: string
}

export function NewNoteButton({ onCreated, parentId }: NewNoteButtonProps) {
    const navigate = useNavigate()
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    // Note: the ref stops a quick double click, because the disabled state only changes after the next render
    const isCreatingRef = useRef(false)

    async function handleCreate() {
        if (isCreatingRef.current) return
        isCreatingRef.current = true
        setError(undefined)
        setIsCreating(true)
        try {
            const note = await createNote({ parentId })
            // Note: only the top-level button registers; a child made with "add a child note" is never removed by itself
            if (parentId === undefined) registerNewNoteDraft(note.id)
            navigate(buildNotePath(note.id))
            onCreated()
        } catch (failure) {
            setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
        } finally {
            isCreatingRef.current = false
            setIsCreating(false)
        }
    }

    return (
        <div className="notes-new-note">
            <button
                className={parentId === undefined ? 'button-primary notes-new-note-button' : 'notes-secondary-button'}
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                aria-busy={isCreating}
            >
                {isCreating && <span className="spinner" aria-hidden="true" />}
                {isCreating ? 'กำลังสร้าง…' : parentId === undefined ? 'New note' : 'เพิ่ม Note ย่อย'}
            </button>
            {error && (
                <div className="notes-error" role="alert">
                    <p>{error.message}</p>
                    {error.reference && <p className="notes-error-reference">รหัสอ้างอิง: {error.reference}</p>}
                    <button className="notes-secondary-button" type="button" onClick={handleCreate} disabled={isCreating}>
                        ลองอีกครั้ง
                    </button>
                </div>
            )}
        </div>
    )
}
