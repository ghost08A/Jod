import { useLayoutEffect, useRef } from 'react'
import { DEFAULT_TITLE } from '../constants/seed-notes'
import type { PrototypeNote } from '../types/prototype-note'

interface NoteEditorFieldsProps {
    note: PrototypeNote
    onChange: (changes: Partial<PrototypeNote>) => void
    autoFocus?: boolean
}

export function NoteEditorFields({ note, onChange, autoFocus }: NoteEditorFieldsProps) {
    const bodyRef = useRef<HTMLTextAreaElement>(null)

    // Note: grow with the text so the page scrolls instead of an inner box
    useLayoutEffect(() => {
        const element = bodyRef.current
        if (!element) return
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
    }, [note.body])

    return (
        <div className="pc-editor">
            <input
                className="pc-title-input"
                value={note.title}
                placeholder={DEFAULT_TITLE}
                onChange={(event) => onChange({ title: event.target.value })}
                aria-label="Title"
            />
            <textarea
                ref={bodyRef}
                className="pc-body-input"
                value={note.body}
                placeholder="กด '/' เพื่อดูคำสั่ง…"
                autoFocus={autoFocus}
                onChange={(event) => onChange({ body: event.target.value })}
                aria-label="เนื้อหา"
            />
        </div>
    )
}
