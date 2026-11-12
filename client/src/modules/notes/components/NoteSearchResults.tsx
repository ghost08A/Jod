import { NavLink } from 'react-router'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import type { useNoteSearch } from '../hooks/useNoteSearch'
import { normalizeNoteTitle } from '../utils/autosave/normalize-note-title'
import { cleanSnippet } from '../utils/search/clean-snippet'
import { splitByMatch } from '../utils/search/split-by-match'
import { buildNotePath } from '../utils/shell/note-path'

type NoteSearchResultsProps = {
    search: ReturnType<typeof useNoteSearch>
    /** Called when a result is chosen (the drawer closes) */
    onSelect: () => void
}

const SKELETON_ROW_COUNT = 5

export function NoteSearchResults({ search, onSelect }: NoteSearchResultsProps) {
    const { query, items, hasMore, error, isLoadingMore, isLoading, loadMore, retry } = search
    if (query === undefined) return null

    if (isLoading) {
        return (
            <div className="notes-list" role="status" aria-label="กำลังค้นหา">
                {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
                    <span key={index} className="skeleton notes-list-skeleton" />
                ))}
            </div>
        )
    }

    if (items === undefined) {
        return (
            <div>
                <ErrorMessage styleScope="notes" message={error?.message} reference={error?.reference} />
                <button className="notes-secondary-button" type="button" onClick={retry}>
                    ลองอีกครั้ง
                </button>
            </div>
        )
    }

    const announcement = items.length === 0 ? 'ไม่พบโน้ตที่ค้นหา' : `พบ ${items.length} โน้ต${hasMore ? ' และยังมีอีก' : ''}`

    return (
        <>
            <p className="notes-visually-hidden" role="status" aria-live="polite">
                {announcement}
            </p>
            {items.length === 0 ? (
                <p className="notes-list-empty">ไม่พบโน้ตที่ค้นหา</p>
            ) : (
                <ul className="notes-list">
                    {items.map((result) => (
                        <li key={result.id}>
                            <NavLink className="notes-list-link notes-search-result" to={buildNotePath(result.id)} onClick={onSelect}>
                                {result.path.length > 0 && (
                                    <span className="notes-search-path">{result.path.map((ancestor) => normalizeNoteTitle(ancestor.title)).join(' / ')}</span>
                                )}
                                <span className="notes-search-title">
                                    <Highlighted text={normalizeNoteTitle(result.title)} query={query} />
                                </span>
                                {result.snippet.length > 0 && (
                                    <span className="notes-search-snippet">
                                        <Highlighted text={cleanSnippet(result.snippet)} query={query} />
                                    </span>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            )}
            {error && <ErrorMessage styleScope="notes" message={error.message} reference={error.reference} />}
            {hasMore && (
                <button className="notes-secondary-button notes-search-more" type="button" onClick={loadMore} disabled={isLoadingMore} aria-busy={isLoadingMore}>
                    {isLoadingMore && <span className="spinner" aria-hidden="true" />}
                    โหลดเพิ่ม
                </button>
            )}
        </>
    )
}

function Highlighted({ text, query }: { text: string; query: string }) {
    return splitByMatch(text, query).map((part, index) => (part.isMatch ? <mark key={index}>{part.text}</mark> : part.text))
}
