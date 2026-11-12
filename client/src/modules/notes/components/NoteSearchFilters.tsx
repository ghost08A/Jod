import { useState } from 'react'
import type { NoteListItem, SearchScope } from '../types/note'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { SearchBranchDialog } from './SearchBranchDialog'

type NoteSearchFiltersProps = {
    scope: SearchScope
    onScopeChange: (scope: SearchScope) => void
    /** The note whose branch is searched; only used outside Trash */
    parentId: string | undefined
    onParentChange: (parentId: string | undefined) => void
    /** The note list, for the titles; undefined while it loads */
    items: NoteListItem[] | undefined
}

/** Where to search (all notes or Trash) and, outside Trash, which branch */
export function NoteSearchFilters({ scope, onScopeChange, parentId, onParentChange, items }: NoteSearchFiltersProps) {
    const [isPicking, setIsPicking] = useState(false)
    const parentTitle = parentId === undefined ? undefined : items?.find((item) => item.id === parentId)?.title

    return (
        <div className="notes-search-filters">
            <select
                className="notes-search-scope"
                aria-label="ค้นหาที่ไหน"
                value={scope}
                onChange={(event) => {
                    const next = event.target.value === 'trash' ? 'trash' : 'all'
                    if (next === 'trash') onParentChange(undefined)
                    onScopeChange(next)
                }}
            >
                <option value="all">ทุก Note</option>
                <option value="trash">ใน Trash</option>
            </select>
            {scope === 'all' &&
                (parentId === undefined ? (
                    <button className="notes-secondary-button" type="button" onClick={() => setIsPicking(true)} disabled={!items}>
                        กรองตามกิ่ง
                    </button>
                ) : (
                    <div className="notes-search-chip">
                        <span className="notes-search-chip-text">กิ่ง: {items && parentTitle === undefined ? 'ไม่พบโน้ตนี้' : normalizeNoteTitle(parentTitle ?? '')}</span>
                        <button className="notes-secondary-button" type="button" onClick={() => onParentChange(undefined)}>
                            ล้างตัวกรอง
                        </button>
                    </div>
                ))}
            {isPicking && items && (
                <SearchBranchDialog
                    items={items}
                    onClose={() => setIsPicking(false)}
                    onPick={(id) => {
                        onParentChange(id)
                        setIsPicking(false)
                    }}
                />
            )}
        </div>
    )
}
