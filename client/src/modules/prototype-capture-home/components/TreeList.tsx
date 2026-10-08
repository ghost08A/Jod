import { useState } from 'react'
import type { PrototypeNote } from '../types/prototype-note'
import { displayTitle } from '../utils/note-label'

interface TreeListProps {
    notes: PrototypeNote[]
    onOpen: (id: string) => void
    openId?: string
}

interface TreeBranchProps extends TreeListProps {
    parentId?: string
    depth: number
}

function TreeBranch({ notes, parentId, depth, onOpen, openId }: TreeBranchProps) {
    const [collapsed, setCollapsed] = useState<string[]>([])
    const children = notes.filter((note) => (parentId
        ? note.placement === 'child' && note.parentId === parentId
        : note.placement === 'root'))

    return (
        <ul className="pc-tree">
            {children.map((note) => {
                const hasChildren = notes.some((item) => item.parentId === note.id && item.placement === 'child')
                const isCollapsed = collapsed.includes(note.id)
                return (
                    <li key={note.id}>
                        <div className={`pc-tree-row ${openId === note.id ? 'is-open' : ''}`} style={{ paddingLeft: 8 + depth * 16 }}>
                            <button
                                type="button"
                                className="pc-tree-toggle"
                                disabled={!hasChildren}
                                onClick={() => setCollapsed((current) => (isCollapsed
                                    ? current.filter((id) => id !== note.id)
                                    : [...current, note.id]))}
                                aria-label={isCollapsed ? 'ขยาย' : 'พับ'}
                            >
                                {hasChildren ? (isCollapsed ? '▸' : '▾') : '·'}
                            </button>
                            <button type="button" className="pc-tree-title" onClick={() => onOpen(note.id)}>
                                {displayTitle(note)}
                            </button>
                        </div>
                        {hasChildren && !isCollapsed && (
                            <TreeBranch notes={notes} parentId={note.id} depth={depth + 1} onOpen={onOpen} openId={openId} />
                        )}
                    </li>
                )
            })}
        </ul>
    )
}

export function TreeList({ notes, onOpen, openId }: TreeListProps) {
    return <TreeBranch notes={notes} depth={0} onOpen={onOpen} openId={openId} />
}
