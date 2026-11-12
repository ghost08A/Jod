import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useTrashList } from '../hooks/useTrashList'
import type { TrashBranch } from '../types/note'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { formatDateTimeMinutes } from '../utils/shell/format-date-time'
import { buildNotePath } from '../utils/shell/note-path'
import { buildTrashTree } from '../utils/tree/build-trash-tree'

const SKELETON_ROW_COUNT = 5
const MAX_INDENT_DEPTH = 6

export function TrashPage() {
    const { items, error, isLoading, retry } = useTrashList()
    const tree = useMemo(() => (items ? buildTrashTree(items) : undefined), [items])
    // Note: branches start closed and are not remembered
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

    function toggle(id: string) {
        setExpanded((previous) => {
            const next = new Set(previous)
            if (!next.delete(id)) next.add(id)
            return next
        })
    }

    return (
        <section className="notes-page">
            <h1 className="notes-trash-title">Trash</h1>
            {error ? (
                <div>
                    <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />
                    <button className="notes-secondary-button" type="button" onClick={retry}>
                        ลองอีกครั้ง
                    </button>
                </div>
            ) : isLoading || !tree ? (
                <div className="notes-list" role="status" aria-label="กำลังโหลด">
                    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                        <span key={index} className="skeleton notes-list-skeleton" />
                    ))}
                </div>
            ) : tree.length === 0 ? (
                <p className="notes-list-empty">Trash ว่างอยู่</p>
            ) : (
                <ul className="notes-list">
                    {tree.map((branch) => (
                        <TrashNode key={branch.item.id} branch={branch} depth={0} expanded={expanded} onToggle={toggle} />
                    ))}
                </ul>
            )}
        </section>
    )
}

type TrashNodeProps = {
    branch: TrashBranch
    depth: number
    expanded: Set<string>
    onToggle: (id: string) => void
}

function TrashNode({ branch, depth, expanded, onToggle }: TrashNodeProps) {
    const { item, children } = branch
    const hasChildren = children.length > 0
    const isExpanded = expanded.has(item.id)
    const title = normalizeNoteTitle(item.title)

    return (
        <li>
            <div className="notes-tree-row" style={{ '--tree-depth': Math.min(depth, MAX_INDENT_DEPTH) } as CSSProperties}>
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
                <Link className="notes-list-link" to={buildNotePath(item.id)}>
                    {title}
                </Link>
                {depth === 0 && <span className="notes-trash-date">{formatDateTimeMinutes(item.deletedAt)}</span>}
            </div>
            {hasChildren && isExpanded && (
                <ul className="notes-list">
                    {children.map((child) => (
                        <TrashNode key={child.item.id} branch={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
                    ))}
                </ul>
            )}
        </li>
    )
}
