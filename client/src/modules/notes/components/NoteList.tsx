import { NavLink } from 'react-router'
import type { ApiError } from '../../../core/http/api-error'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { buildNotePath } from '../utils/shell/note-path'
import type { NoteListItem } from '../types/note'

type NoteListProps = {
    items: NoteListItem[] | undefined
    error: ApiError | undefined
    isLoading: boolean
    onRetry: () => void
    /** Called when a row is chosen (the drawer closes) */
    onSelect: () => void
}

const SKELETON_ROW_COUNT = 5

export function NoteList({ items, error, isLoading, onRetry, onSelect }: NoteListProps) {
    if (error) {
        return (
            <div className="notes-error" role="alert">
                <p>{error.message}</p>
                {error.reference && <p className="notes-error-reference">รหัสอ้างอิง: {error.reference}</p>}
                <button className="notes-secondary-button" type="button" onClick={onRetry}>
                    ลองอีกครั้ง
                </button>
            </div>
        )
    }

    if (isLoading || !items) {
        return (
            <div className="notes-list" role="status" aria-label="กำลังโหลด">
                {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                    <span key={index} className="skeleton notes-list-skeleton" />
                ))}
            </div>
        )
    }

    if (items.length === 0) return <p className="notes-list-empty">ยังไม่มีโน้ต</p>

    return (
        <ul className="notes-list">
            {items.map((item) => (
                <li key={item.id}>
                    <NavLink className="notes-list-link" to={buildNotePath(item.id)} onClick={onSelect}>
                        {normalizeNoteTitle(item.title)}
                    </NavLink>
                </li>
            ))}
        </ul>
    )
}
