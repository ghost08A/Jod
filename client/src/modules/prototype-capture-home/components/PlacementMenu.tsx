import { useState } from 'react'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import type { PrototypeNote } from '../types/prototype-note'
import { displayTitle, parentLabel } from '../utils/note-label'

interface PlacementMenuProps {
    note: PrototypeNote
    api: PrototypeNotesApi
}

// Note: quiet text control in the top-right of the canvas; never blocks writing
export function PlacementMenu({ note, api }: PlacementMenuProps) {
    const [open, setOpen] = useState(false)
    const { notes } = api
    const suggestion = note.suggestion
    const isPlaced = note.placement !== 'unplaced'
    const candidates = notes.filter((item) => item.id !== note.id && item.placement !== 'unplaced')

    function run(action: () => void) {
        action()
        setOpen(false)
    }

    function placeUnder(parentId: string | undefined) {
        if (note.isDraft) api.saveDraft(note.id, 'unplaced')
        api.moveTo(note.id, parentId)
    }

    function askAi() {
        if (note.isDraft) api.saveDraft(note.id, 'ai')
        else api.askAi(note.id)
    }

    let label = isPlaced ? 'ย้าย' : 'จัดวาง'
    if (!isPlaced && suggestion?.state === 'loading') label = '✦ AI กำลังดู…'
    if (!isPlaced && suggestion?.state === 'ready') label = `✦ ใต้ ${parentLabel(notes, suggestion.parentId)}`
    if (!isPlaced && suggestion?.state === 'none') label = '✦ ไม่พบที่เหมาะสม'

    return (
        <div className="pc-placement">
            <button type="button" className="pc-quiet" onClick={() => setOpen(!open)} aria-expanded={open}>{label}</button>
            {open && (
                <>
                    <button type="button" className="pc-backdrop" aria-label="ปิดเมนู" onClick={() => setOpen(false)} />
                    <div className="pc-menu" role="menu">
                        {!isPlaced && suggestion?.state === 'ready' && (
                            <div className="pc-menu-suggest">
                                AI เสนอ: ใต้ <strong>{parentLabel(notes, suggestion.parentId)}</strong>
                                <span>
                                    <button type="button" onClick={() => run(() => api.confirmSuggestion(note.id))}>ย้าย</button>
                                    <button type="button" onClick={() => run(() => api.rejectSuggestion(note.id))}>ไม่เอา</button>
                                </span>
                            </div>
                        )}
                        {!isPlaced && suggestion?.state !== 'ready' && suggestion?.state !== 'loading' && (
                            <button type="button" role="menuitem" onClick={() => run(askAi)}>✦ ให้ AI จัดให้</button>
                        )}
                        {note.placement !== 'root' && (
                            <button type="button" role="menuitem" onClick={() => run(() => placeUnder(undefined))}>
                                เป็นแม่ใหม่ (Root note)
                            </button>
                        )}
                        {note.isDraft && (
                            <button type="button" role="menuitem" onClick={() => run(() => api.saveDraft(note.id, 'unplaced'))}>
                                ปล่อยไว้ รอจัดวาง
                            </button>
                        )}
                        <div className="pc-menu-label">ย้ายไปไว้ใต้</div>
                        <div className="pc-menu-list">
                            {candidates.map((item) => (
                                <button key={item.id} type="button" role="menuitem" onClick={() => run(() => placeUnder(item.id))}>
                                    {displayTitle(item)}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
