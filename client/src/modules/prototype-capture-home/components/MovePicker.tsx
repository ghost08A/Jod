import type { PrototypeNote } from '../types/prototype-note'
import { displayTitle } from '../utils/note-label'

interface MovePickerProps {
    note: PrototypeNote
    notes: PrototypeNote[]
    onMove: (parentId: string | undefined) => void
}

export function MovePicker({ note, notes, onMove }: MovePickerProps) {
    const candidates = notes.filter((item) => item.id !== note.id && item.placement !== 'unplaced')
    const value = note.placement === 'child' ? note.parentId : note.placement === 'root' ? 'ROOT' : ''
    return (
        <label className="pc-move">
            ย้ายไปไว้ใต้
            <select
                value={value ?? ''}
                onChange={(event) => {
                    if (event.target.value === '') return
                    onMove(event.target.value === 'ROOT' ? undefined : event.target.value)
                }}
            >
                <option value="">— ยังไม่จัดวาง —</option>
                <option value="ROOT">(ระดับบนสุด = Root note)</option>
                {candidates.map((item) => (
                    <option key={item.id} value={item.id}>{displayTitle(item)}</option>
                ))}
            </select>
        </label>
    )
}
