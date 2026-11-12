import { useRef, type KeyboardEvent } from 'react'
import { MAX_SEARCH_LENGTH } from '../utils/search/search-query'

type NoteSearchBoxProps = {
    value: string
    onChange: (value: string) => void
}

export function NoteSearchBox({ value, onChange }: NoteSearchBoxProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    function clear() {
        onChange('')
        inputRef.current?.focus()
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        // Note: Escape with text only clears it; with an empty box it goes on to close the drawer
        if (event.key === 'Escape' && value.length > 0) {
            event.stopPropagation()
            clear()
        }
    }

    return (
        <div className="notes-search" role="search">
            <input
                ref={inputRef}
                className="notes-search-input"
                type="search"
                aria-label="ค้นหาโน้ต"
                placeholder="ค้นหาโน้ต"
                autoComplete="off"
                maxLength={MAX_SEARCH_LENGTH}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={handleKeyDown}
            />
            {value.length > 0 && (
                <button className="notes-icon-button notes-search-clear" type="button" onClick={clear} aria-label="ล้างคำค้น">
                    ×
                </button>
            )}
        </div>
    )
}
