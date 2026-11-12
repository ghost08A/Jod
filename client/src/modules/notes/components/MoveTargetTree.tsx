import { useMemo, useState, type CSSProperties } from 'react'
import type { NoteBranch, NoteListItem } from '../types/note'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { buildNoteTree } from '../utils/tree/build-note-tree'
import { expandIds, toggleExpandedId } from '../utils/tree/expanded-notes'
import { noteAncestors } from '../utils/tree/note-ancestors'
import { canMoveInto } from '../utils/tree/note-placement'

type MoveTargetTreeProps = {
    items: NoteListItem[]
    noteId: string
    isMoving: boolean
    onPick: (targetId: string) => void
}

/** The notes as a tree to pick a new parent from. Starts closed except the path to the current parent; only open branches are drawn */
export function MoveTargetTree({ items, noteId, isMoving, onPick }: MoveTargetTreeProps) {
    const tree = useMemo(() => buildNoteTree(items), [items])
    const [expanded, setExpanded] = useState(() => expandIds(new Set(), noteAncestors(items, noteId).map((ancestor) => ancestor.id)))
    const sections = [
        { title: 'โน้ตหลัก', branches: tree.root },
        { title: 'รอจัดวาง', branches: tree.unplaced },
    ]

    return (
        <div className="notes-move-tree">
            {sections
                .filter((section) => section.branches.length > 0)
                .map((section) => (
                    <section key={section.title}>
                        <h3 className="notes-tree-heading">{section.title}</h3>
                        <ul className="notes-list">
                            {section.branches.map((branch) => (
                                <TargetRow
                                    key={branch.item.id}
                                    branch={branch}
                                    depth={0}
                                    items={items}
                                    noteId={noteId}
                                    expanded={expanded}
                                    isMoving={isMoving}
                                    onToggle={(id) => setExpanded((previous) => toggleExpandedId(previous, id))}
                                    onPick={onPick}
                                />
                            ))}
                        </ul>
                    </section>
                ))}
        </div>
    )
}

type TargetRowProps = MoveTargetTreeProps & {
    branch: NoteBranch
    depth: number
    expanded: Set<string>
    onToggle: (id: string) => void
}

/** Deeper levels are indented no further, so a very deep tree stays inside the dialog */
const MAX_INDENT_DEPTH = 6

function TargetRow({ branch, depth, items, noteId, expanded, isMoving, onToggle, onPick }: TargetRowProps) {
    const { item, children } = branch
    const title = normalizeNoteTitle(item.title)
    const isExpanded = expanded.has(item.id)
    const check = canMoveInto(items, noteId, item.id)
    const reasonId = `notes-move-reason-${item.id}`

    return (
        <li>
            <div className="notes-tree-row notes-move-row" style={{ '--tree-depth': Math.min(depth, MAX_INDENT_DEPTH) } as CSSProperties}>
                {children.length > 0 ? (
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
                <div className="notes-move-row-text">
                    <span className="notes-move-row-title">{title}</span>
                    {!check.ok && (
                        <span id={reasonId} className="notes-move-hint">
                            {check.reason}
                        </span>
                    )}
                </div>
                <button
                    className="notes-secondary-button notes-move-pick"
                    type="button"
                    disabled={!check.ok || isMoving}
                    aria-describedby={check.ok ? undefined : reasonId}
                    aria-label={`ย้ายมาที่นี่: ${title}`}
                    onClick={() => onPick(item.id)}
                >
                    ย้ายมาที่นี่
                </button>
            </div>
            {children.length > 0 && isExpanded && (
                <ul className="notes-list">
                    {children.map((child) => (
                        <TargetRow
                            key={child.item.id}
                            branch={child}
                            depth={depth + 1}
                            items={items}
                            noteId={noteId}
                            expanded={expanded}
                            isMoving={isMoving}
                            onToggle={onToggle}
                            onPick={onPick}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}
