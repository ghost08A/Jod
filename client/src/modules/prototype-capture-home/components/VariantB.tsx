import { useState } from 'react'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import { bodyPreview, displayTitle, isEmptyDraft } from '../utils/note-label'
import { MovePicker } from './MovePicker'
import { NoteEditorFields } from './NoteEditorFields'
import { SuggestionBadge } from './SuggestionBadge'
import { TreeList } from './TreeList'

// Note: Variant B = inbox-first single column; Save choices appear as a sheet only after "เสร็จ"
export function VariantB({ api }: { api: PrototypeNotesApi }) {
    const [openId, setOpenId] = useState<string | undefined>()
    const [choosing, setChoosing] = useState(false)
    const [showTree, setShowTree] = useState(false)
    const { notes } = api
    const open = notes.find((note) => note.id === openId)
    const unplaced = notes.filter((note) => note.placement === 'unplaced' && !isEmptyDraft(note))

    function done() {
        if (!open) return
        if (open.isDraft) {
            if (open.title === '' && open.body.trim() === '') {
                api.closeDraft(open.id)
                setOpenId(undefined)
                return
            }
            setChoosing(true)
            return
        }
        setOpenId(undefined)
    }

    function choose(choice: 'ai' | 'root' | 'unplaced') {
        if (!open) return
        api.saveDraft(open.id, choice)
        setChoosing(false)
        setOpenId(undefined)
    }

    function skipChoice() {
        if (open) api.closeDraft(open.id)
        setChoosing(false)
        setOpenId(undefined)
    }

    if (open) {
        return (
            <div className="pc-b pc-b-edit">
                <header className="pc-b-bar">
                    <button type="button" className="pc-link-button" onClick={open.isDraft ? skipChoice : done}>← กลับ</button>
                    <button type="button" className="pc-primary" onClick={done}>เสร็จ</button>
                </header>
                <NoteEditorFields note={open} onChange={(changes) => api.patch(open.id, changes)} autoFocus />
                {!open.isDraft && <MovePicker note={open} notes={notes} onMove={(parentId) => api.moveTo(open.id, parentId)} />}
                {choosing && (
                    <div className="pc-b-sheet" role="dialog" aria-label="เลือกที่วาง">
                        <h2>จัดวางที่ไหนดี?</h2>
                        <button type="button" className="pc-b-choice" onClick={() => choose('ai')}>
                            <strong>✨ ให้ AI จัดให้</strong><span>AI เสนอที่วาง คุณกดยืนยันเอง</span>
                        </button>
                        <button type="button" className="pc-b-choice" onClick={() => choose('root')}>
                            <strong>เป็นแม่ใหม่ (Root note)</strong><span>วางไว้ระดับบนสุดของ Tree</span>
                        </button>
                        <button type="button" className="pc-b-choice" onClick={() => choose('unplaced')}>
                            <strong>ไว้ก่อน (รอจัดวาง)</strong><span>จดไว้ก่อน ค่อยจัดทีหลัง</span>
                        </button>
                        <button type="button" className="pc-link-button" onClick={() => setChoosing(false)}>กลับไปเขียนต่อ</button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="pc-b">
            <button type="button" className="pc-b-capture" onClick={() => setOpenId(api.startDraft())}>
                จดอะไรดี… <span>+ New note</span>
            </button>
            <h2 className="pc-heading">รอจัดวาง <span className="pc-count">{unplaced.length}</span></h2>
            <ul className="pc-b-cards">
                {unplaced.map((note) => (
                    <li key={note.id} className="pc-b-card">
                        <button type="button" className="pc-row-main" onClick={() => setOpenId(note.id)}>
                            <strong>{displayTitle(note)}</strong>
                            <span className="pc-muted">{bodyPreview(note)}</span>
                        </button>
                        <SuggestionBadge
                            note={note}
                            notes={notes}
                            onAsk={() => api.askAi(note.id)}
                            onConfirm={() => api.confirmSuggestion(note.id)}
                            onReject={() => api.rejectSuggestion(note.id)}
                        />
                    </li>
                ))}
            </ul>
            <button type="button" className="pc-secondary" onClick={() => setShowTree(!showTree)}>
                {showTree ? 'ซ่อน Tree' : 'ดู Tree ทั้งหมด'}
            </button>
            {showTree && <TreeList notes={notes} onOpen={setOpenId} />}
        </div>
    )
}
