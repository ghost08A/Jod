import { useMemo } from 'react'
import { useMatch } from 'react-router'
import type { ApiError } from '../../../core/http/api-error'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useExpandedNotes } from '../hooks/useExpandedNotes'
import type { NoteBranch, NoteListItem } from '../types/note'
import { buildNoteTree } from '../utils/tree/build-note-tree'
import { NoteTreeNode } from './NoteTreeNode'

type NoteTreeProps = {
    items: NoteListItem[] | undefined
    error: ApiError | undefined
    isLoading: boolean
    onRetry: () => void
    /** Called when a row is chosen (the drawer closes) */
    onSelect: () => void
}

const SKELETON_ROW_COUNT = 5

export function NoteTree({ items, error, isLoading, onRetry, onSelect }: NoteTreeProps) {
    const openNoteId = useMatch('/notes/:noteId')?.params.noteId
    const { expanded, toggle } = useExpandedNotes(items, openNoteId)
    const tree = useMemo(() => (items ? buildNoteTree(items) : undefined), [items])

    if (error) {
        return (
            <div>
                <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />
                <button className="notes-secondary-button" type="button" onClick={onRetry}>
                    ลองอีกครั้ง
                </button>
            </div>
        )
    }

    if (isLoading || !items || !tree) {
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
        <>
            {tree.root.length > 0 && <NoteTreeSection title="โน้ตหลัก" branches={tree.root} expanded={expanded} onToggle={toggle} onSelect={onSelect} />}
            {tree.unplaced.length > 0 && <NoteTreeSection title="รอจัดวาง" branches={tree.unplaced} expanded={expanded} onToggle={toggle} onSelect={onSelect} />}
        </>
    )
}

type NoteTreeSectionProps = {
    title: string
    branches: NoteBranch[]
    expanded: Set<string>
    onToggle: (id: string) => void
    onSelect: () => void
}

function NoteTreeSection({ title, branches, expanded, onToggle, onSelect }: NoteTreeSectionProps) {
    return (
        <section className="notes-tree-section">
            <h2 className="notes-tree-heading">{title}</h2>
            <ul className="notes-list">
                {branches.map((branch) => (
                    <NoteTreeNode key={branch.item.id} branch={branch} depth={0} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
                ))}
            </ul>
        </section>
    )
}
