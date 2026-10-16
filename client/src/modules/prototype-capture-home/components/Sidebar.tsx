import { useState } from 'react'
import type { PrototypeNote } from '../types/prototype-note'
import { bodyPreview, displayTitle, isEmptyDraft } from '../utils/note-label'

interface SidebarProps {
    notes: PrototypeNote[]
    openId?: string
    onNew: () => void
    onOpen: (id: string) => void
}

export function Sidebar({ notes, openId, onNew, onOpen }: SidebarProps) {
    const [collapsed, setCollapsed] = useState<string[]>([])
    const unplaced = notes.filter((note) => note.placement === 'unplaced' && !isEmptyDraft(note))

    function toggle(id: string) {
        setCollapsed((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
    }

    function renderBranch(parentId: string | undefined, depth: number) {
        const children = notes.filter((note) => (parentId
            ? note.placement === 'child' && note.parentId === parentId
            : note.placement === 'root'))
        return children.map((note) => {
            const hasChildren = notes.some((item) => item.placement === 'child' && item.parentId === note.id)
            const isCollapsed = collapsed.includes(note.id)
            return (
                <div key={note.id}>
                    <div className={`pc-row ${openId === note.id ? 'is-selected' : ''}`} style={{ paddingLeft: 6 + depth * 14 }}>
                        <button
                            type="button"
                            className="pc-caret"
                            disabled={!hasChildren}
                            onClick={() => toggle(note.id)}
                            aria-label={isCollapsed ? 'ขยาย' : 'พับ'}
                        >
                            {hasChildren ? (isCollapsed ? '▸' : '▾') : ''}
                        </button>
                        <button type="button" className="pc-row-label" onClick={() => onOpen(note.id)}>
                            {displayTitle(note)}
                        </button>
                    </div>
                    {hasChildren && !isCollapsed && renderBranch(note.id, depth + 1)}
                </div>
            )
        })
    }

    return (
        <nav className="pc-sidebar" aria-label="Notes">
            <div className="pc-workspace-name">Jod</div>
            <button type="button" className="pc-row pc-new" onClick={onNew}>
                <span className="pc-plus">＋</span> New note
            </button>
            <div className="pc-section">Notes</div>
            {renderBranch(undefined, 0)}
            <div className="pc-section">รอจัดวาง <span>{unplaced.length}</span></div>
            {unplaced.map((note) => (
                <div key={note.id} className={`pc-row ${openId === note.id ? 'is-selected' : ''}`} style={{ paddingLeft: 6 }}>
                    <span className="pc-caret">{note.suggestion?.state === 'ready' ? '✦' : ''}</span>
                    <button type="button" className="pc-row-label" onClick={() => onOpen(note.id)}>
                        {displayTitle(note)}
                        {note.title === '' && <span className="pc-preview"> {bodyPreview(note)}</span>}
                    </button>
                </div>
            ))}
        </nav>
    )
}
