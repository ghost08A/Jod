import { Link } from 'react-router'
import type { NoteListItem } from '../types/note'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { buildNotePath } from '../utils/shell/note-path'
import { noteAncestors } from '../utils/tree/note-ancestors'

type BreadcrumbProps = {
    /** The list the sidebar already loaded; undefined while it is loading */
    items: NoteListItem[] | undefined
    noteId: string
}

export function Breadcrumb({ items, noteId }: BreadcrumbProps) {
    const ancestors = items ? noteAncestors(items, noteId) : []
    if (ancestors.length === 0) return null

    return (
        <nav className="notes-breadcrumb" aria-label="ตำแหน่งของโน้ต">
            <ol>
                {ancestors.map((ancestor) => (
                    <li key={ancestor.id}>
                        <Link to={buildNotePath(ancestor.id)}>{normalizeNoteTitle(ancestor.title)}</Link>
                    </li>
                ))}
            </ol>
        </nav>
    )
}
