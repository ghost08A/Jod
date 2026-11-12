import type { CSSProperties } from 'react'
import { NavLink } from 'react-router'
import type { useNoteDrag } from '../hooks/useNoteDrag'
import type { NoteBranch } from '../types/note'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { buildNotePath } from '../utils/shell/note-path'

type NoteTreeNodeProps = {
    branch: NoteBranch
    depth: number
    expanded: Set<string>
    onToggle: (id: string) => void
    onSelect: () => void
    drag: ReturnType<typeof useNoteDrag>
}

/** Deeper levels are indented no further, so a very deep tree stays inside the sidebar */
const MAX_INDENT_DEPTH = 6

export function NoteTreeNode({ branch, depth, expanded, onToggle, onSelect, drag }: NoteTreeNodeProps) {
    const { item, children } = branch
    const hasChildren = children.length > 0
    const isExpanded = expanded.has(item.id)
    const title = normalizeNoteTitle(item.title)
    const dropZone = drag.indicator?.targetId === item.id ? drag.indicator.zone : undefined

    return (
        <li>
            <div
                className="notes-tree-row"
                style={{ '--tree-depth': Math.min(depth, MAX_INDENT_DEPTH) } as CSSProperties}
                draggable
                data-dragging={drag.draggedId === item.id || undefined}
                data-drop-zone={dropZone}
                onDragStart={(event) => drag.handleDragStart(event, item.id)}
                onDragEnd={drag.handleDragEnd}
                onDragOver={(event) => drag.handleDragOver(event, item.id)}
                onDrop={(event) => drag.handleDrop(event, item.id)}
            >
                {hasChildren ? (
                    <button
                        className="notes-tree-toggle"
                        type="button"
                        onClick={() => onToggle(item.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'ย่อ' : 'ขยาย'}โน้ตย่อยของ ${title}`}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" data-expanded={isExpanded}>
                            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                    </button>
                ) : (
                    <span className="notes-tree-toggle-spacer" aria-hidden="true" />
                )}
                <NavLink className="notes-list-link" to={buildNotePath(item.id)} onClick={onSelect}>
                    {title}
                </NavLink>
            </div>
            {hasChildren && isExpanded && (
                <ul className="notes-list">
                    {children.map((child) => (
                        <NoteTreeNode key={child.item.id} branch={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onSelect={onSelect} drag={drag} />
                    ))}
                </ul>
            )}
        </li>
    )
}
