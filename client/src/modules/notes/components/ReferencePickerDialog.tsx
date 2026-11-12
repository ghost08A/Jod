import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useNoteSearch } from '../hooks/useNoteSearch'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { splitByMatch } from '../utils/search/split-by-match'

type ReferencePickerDialogProps = {
    onPick: (noteId: string) => void
    onClose: () => void
}

const SKELETON_ROW_COUNT = 5

/** A modal to search the notes and choose the one a new card points at. The search text stays in this component only */
export function ReferencePickerDialog({ onPick, onClose }: ReferencePickerDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [text, setText] = useState('')
    const { query, items, hasMore, error, isLoadingMore, isLoading, loadMore, retry } = useNoteSearch(text, 'all', undefined)

    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) dialog.showModal()
    }, [])

    return (
        <dialog ref={dialogRef} className="notes-conflict-dialog notes-move-dialog" aria-labelledby="notes-reference-picker-title" onClose={onClose}>
            <h2 id="notes-reference-picker-title" className="notes-conflict-dialog-title">
                แทรกการ์ดอ้างอิงโน้ต
            </h2>
            <input
                className="notes-search-input"
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="ค้นหาโน้ตที่จะอ้างอิง"
                aria-label="ค้นหาโน้ตที่จะอ้างอิง"
                autoComplete="off"
                autoFocus
            />
            {query === undefined ? (
                <p className="notes-list-empty">พิมพ์ชื่อหรือเนื้อหาของโน้ตที่ต้องการ</p>
            ) : isLoading ? (
                <div className="notes-list" role="status" aria-label="กำลังค้นหา">
                    {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                        <span key={index} className="skeleton notes-list-skeleton" />
                    ))}
                </div>
            ) : items === undefined ? (
                <div>
                    <ErrorMessage styleScope="notes" message={error?.message} reference={error?.reference} />
                    <button className="notes-secondary-button" type="button" onClick={retry}>
                        ลองอีกครั้ง
                    </button>
                </div>
            ) : items.length === 0 ? (
                <p className="notes-list-empty" role="status">
                    ไม่พบโน้ตที่ค้นหา
                </p>
            ) : (
                <ul className="notes-list">
                    {items.map((result) => (
                        <li key={result.id}>
                            <button className="notes-list-link notes-search-result notes-reference-result" type="button" onClick={() => onPick(result.id)}>
                                {result.path.length > 0 && (
                                    <span className="notes-search-path">{result.path.map((ancestor) => normalizeNoteTitle(ancestor.title)).join(' / ')}</span>
                                )}
                                <span className="notes-search-title">
                                    {splitByMatch(normalizeNoteTitle(result.title), query).map((part, index) =>
                                        part.isMatch ? <mark key={index}>{part.text}</mark> : part.text,
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {items !== undefined && error && <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />}
            {hasMore && (
                <button className="notes-secondary-button notes-search-more" type="button" onClick={loadMore} disabled={isLoadingMore} aria-busy={isLoadingMore}>
                    {isLoadingMore && <span className="spinner" aria-hidden="true" />}
                    โหลดเพิ่ม
                </button>
            )}
            <div className="notes-conflict-dialog-actions">
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={() => dialogRef.current?.close()}>
                    ปิด
                </button>
            </div>
        </dialog>
    )
}
