import { useMemo, useState, type CSSProperties } from 'react'
import type { NoteBranch, NoteListItem } from '../types/note'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { buildNoteTree } from '../utils/tree/build-note-tree'
import { expandIds, toggleExpandedId } from '../utils/tree/expanded-notes'
import { noteAncestors } from '../utils/tree/note-ancestors'
import { CANNOT_MOVE_INTO_SELF_REASON, noteDescendantIds } from '../utils/tree/note-placement'

type MoveTargetTreeProps = {
    items: NoteListItem[]
    /** The note being moved; it and its descendants cannot be picked. Without it every note can be picked */
    noteId?: string
    isMoving: boolean
    onPick: (targetId: string) => void
    /** Text of each pick button; the row's title is added for screen readers */
    pickLabel?: string
}

/** The notes as a tree to pick a new parent from. Starts closed except the path to the current parent; only open branches are drawn */
export function MoveTargetTree({ items, noteId, isMoving, onPick, pickLabel = 'ย้ายมาที่นี่' }: MoveTargetTreeProps) {
    const tree = useMemo(() => buildNoteTree(items), [items])
    // Note: worked out once here, not once per row (a row asks for every note on screen)
    const blockedIds = useMemo(() => new Set(noteId === undefined ? [] : [noteId, ...noteDescendantIds(items, noteId)]), [items, noteId])
    const [expanded, setExpanded] = useState(() => expandIds(new Set(), (noteId === undefined ? [] : noteAncestors(items, noteId)).map((ancestor) => ancestor.id)))
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
                                    blockedIds={blockedIds}
                                    expanded={expanded}
                                    isMoving={isMoving}
                                    pickLabel={pickLabel}
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

type TargetRowProps = Pick<MoveTargetTreeProps, 'isMoving' | 'onPick'> & {
    pickLabel: string
    blockedIds: Set<string>
    branch: NoteBranch
    depth: number
    expanded: Set<string>
    onToggle: (id: string) => void
}

/** Deeper levels are indented no further, so a very deep tree stays inside the dialog */
const MAX_INDENT_DEPTH = 6

function TargetRow({ pickLabel, branch, depth, blockedIds, expanded, isMoving, onToggle, onPick }: TargetRowProps) {
    const { item, children } = branch
    const title = normalizeNoteTitle(item.title)
    const isExpanded = expanded.has(item.id)
    const check = blockedIds.has(item.id) ? { ok: false as const, reason: CANNOT_MOVE_INTO_SELF_REASON } : { ok: true as const }
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
                    aria-label={`${pickLabel}: ${title}`}
                    onClick={() => onPick(item.id)}
                >
                    {pickLabel}
                </button>
            </div>
            {children.length > 0 && isExpanded && (
                <ul className="notes-list">
                    {children.map((child) => (
                        <TargetRow
                            key={child.item.id}
                            branch={child}
                            depth={depth + 1}
                            blockedIds={blockedIds}
                            expanded={expanded}
                            isMoving={isMoving}
                            pickLabel={pickLabel}
                            onToggle={onToggle}
                            onPick={onPick}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}
