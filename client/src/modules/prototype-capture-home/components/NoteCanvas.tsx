import { useLayoutEffect, useRef } from 'react'
import { DEFAULT_TITLE } from '../constants/seed-notes'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import type { PrototypeNote } from '../types/prototype-note'
import { notePath } from '../utils/note-label'
import { PlacementMenu } from './PlacementMenu'

interface NoteCanvasProps {
    note: PrototypeNote
    api: PrototypeNotesApi
    onToggleSidebar: () => void
    onFormat: () => void
}

// Note: one open surface - title and body live on the same canvas, no boxes, no footer
export function NoteCanvas({ note, api, onToggleSidebar, onFormat }: NoteCanvasProps) {
    const bodyRef = useRef<HTMLTextAreaElement>(null)
    const titleRef = useRef<HTMLInputElement>(null)

    useLayoutEffect(() => {
        const element = bodyRef.current
        if (!element) return
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
    }, [note.body])

    useLayoutEffect(() => {
        const element = bodyRef.current
        element?.focus()
        element?.setSelectionRange(element.value.length, element.value.length)
    }, [])

    function focusBodyEnd() {
        const element = bodyRef.current
        element?.focus()
        element?.setSelectionRange(element.value.length, element.value.length)
    }

    return (
        <div className="pc-canvas">
            <header className="pc-topbar">
                <button type="button" className="pc-quiet pc-toggle" onClick={onToggleSidebar} aria-label="ซ่อน/แสดงแถบข้าง (Ctrl+\)">☰</button>
                <span className="pc-path">{notePath(api.notes, note)}</span>
                <button type="button" className="pc-quiet" onClick={onFormat}>✦ จัดโครงสร้าง</button>
                <PlacementMenu note={note} api={api} />
            </header>
            <div
                className="pc-page"
                onClick={(event) => {
                    if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('pc-column')) {
                        focusBodyEnd()
                    }
                }}
            >
                <div className="pc-column">
                    <input
                        ref={titleRef}
                        className="pc-title"
                        value={note.title}
                        placeholder={DEFAULT_TITLE}
                        onChange={(event) => api.patch(note.id, { title: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                bodyRef.current?.focus()
                            }
                        }}
                        aria-label="Title"
                    />
                    <textarea
                        ref={bodyRef}
                        className="pc-body"
                        value={note.body}
                        placeholder="กด '/' เพื่อดูคำสั่ง…"
                        onChange={(event) => api.patch(note.id, { body: event.target.value })}
                        onKeyDown={(event) => {
                            const element = event.currentTarget
                            if (event.key === 'ArrowUp' && element.selectionStart === 0 && element.selectionEnd === 0) {
                                event.preventDefault()
                                titleRef.current?.focus()
                            }
                        }}
                        aria-label="เนื้อหา"
                    />
                </div>
            </div>
        </div>
    )
}
