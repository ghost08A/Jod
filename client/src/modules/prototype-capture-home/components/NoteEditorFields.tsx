import { DEFAULT_TITLE } from '../constants/seed-notes'
import type { PrototypeNote } from '../types/prototype-note'

interface NoteEditorFieldsProps {
    note: PrototypeNote
    onChange: (changes: Partial<PrototypeNote>) => void
    autoFocus?: boolean
}

export function NoteEditorFields({ note, onChange, autoFocus }: NoteEditorFieldsProps) {
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
                className="pc-body-input"
                value={note.body}
                placeholder="เริ่มจดได้เลย…"
                autoFocus={autoFocus}
                onChange={(event) => onChange({ body: event.target.value })}
                aria-label="เนื้อหา"
            />
        </div>
    )
}
