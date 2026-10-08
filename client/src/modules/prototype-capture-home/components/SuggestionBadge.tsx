import type { PrototypeNote } from '../types/prototype-note'
import { parentLabel } from '../utils/note-label'

interface SuggestionBadgeProps {
    note: PrototypeNote
    notes: PrototypeNote[]
    onAsk: () => void
    onConfirm: () => void
    onReject: () => void
}

export function SuggestionBadge({ note, notes, onAsk, onConfirm, onReject }: SuggestionBadgeProps) {
    const suggestion = note.suggestion
    if (!suggestion) {
        return <button type="button" className="pc-link-button" onClick={onAsk}>ให้ AI เสนอที่วาง</button>
    }
    if (suggestion.state === 'loading') return <span className="pc-muted">AI กำลังดู…</span>
    if (suggestion.state === 'none') {
        return (
            <span className="pc-muted">
                AI: ไม่พบที่เหมาะสม · <button type="button" className="pc-link-button" onClick={onAsk}>ลองใหม่</button>
            </span>
        )
    }
    return (
        <span className="pc-suggestion">
            AI เสนอ: ใต้ <strong>{parentLabel(notes, suggestion.parentId)}</strong>
            <button type="button" className="pc-chip pc-chip-yes" onClick={onConfirm}>ย้าย</button>
            <button type="button" className="pc-chip" onClick={onReject}>ไม่เอา</button>
        </span>
    )
}
