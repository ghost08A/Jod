import { useState } from 'react'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import { bodyPreview, displayTitle, isEmptyDraft } from '../utils/note-label'
import { MovePicker } from './MovePicker'
import { NoteEditorFields } from './NoteEditorFields'
import { SuggestionBadge } from './SuggestionBadge'
import { TreeList } from './TreeList'

type Tab = 'tree' | 'unplaced'

// Note: Variant C = tabs (Tree | รอจัดวาง) + one Save button whose default is Unplaced, other choices in its menu
export function VariantC({ api }: { api: PrototypeNotesApi }) {
    const [tab, setTab] = useState<Tab>('tree')
    const [openId, setOpenId] = useState<string | undefined>()
    const [menuOpen, setMenuOpen] = useState(false)
    const { notes } = api
    const open = notes.find((note) => note.id === openId)
    const unplaced = notes.filter((note) => note.placement === 'unplaced' && !isEmptyDraft(note))

    function save(choice: 'ai' | 'root' | 'unplaced') {
        if (!open) return
        api.saveDraft(open.id, choice)
        setMenuOpen(false)
        setOpenId(undefined)
        if (choice !== 'root') setTab('unplaced')
    }

    function close() {
        if (open?.isDraft) api.closeDraft(open.id)
        setMenuOpen(false)
        setOpenId(undefined)
    }

    if (open) {
        return (
            <div className="pc-c pc-c-edit">
                <header className="pc-c-bar">
                    <button type="button" className="pc-link-button" onClick={close}>✕ ปิด</button>
                    {open.isDraft ? (
                        <div className="pc-c-split">
                            <button type="button" className="pc-primary" onClick={() => save('unplaced')}>Save</button>
                            <button
                                type="button"
                                className="pc-primary pc-c-caret"
                                aria-label="ตัวเลือกการ Save"
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen(!menuOpen)}
                            >▾</button>
                            {menuOpen && (
                                <ul className="pc-c-menu">
                                    <li><button type="button" onClick={() => save('ai')}>✨ ให้ AI จัดให้</button></li>
                                    <li><button type="button" onClick={() => save('root')}>เป็นแม่ใหม่ (Root)</button></li>
                                    <li><button type="button" onClick={() => save('unplaced')}>ปล่อยไว้ รอจัดวาง</button></li>
                                </ul>
                            )}
                        </div>
                    ) : (
                        <MovePicker note={open} notes={notes} onMove={(parentId) => api.moveTo(open.id, parentId)} />
                    )}
                </header>
                <NoteEditorFields note={open} onChange={(changes) => api.patch(open.id, changes)} autoFocus />
            </div>
        )
    }

    return (
        <div className="pc-c">
            <header className="pc-c-bar">
                <nav className="pc-c-tabs" aria-label="หน้าแรก">
                    <button type="button" className={tab === 'tree' ? 'is-on' : ''} onClick={() => setTab('tree')}>Tree</button>
                    <button type="button" className={tab === 'unplaced' ? 'is-on' : ''} onClick={() => setTab('unplaced')}>
                        รอจัดวาง <span className="pc-count">{unplaced.length}</span>
                    </button>
                </nav>
                <button type="button" className="pc-primary" onClick={() => setOpenId(api.startDraft())}>+ New note</button>
            </header>
            {tab === 'tree' && <TreeList notes={notes} onOpen={setOpenId} />}
            {tab === 'unplaced' && (
                <table className="pc-c-table">
                    <thead><tr><th>Note</th><th>AI</th></tr></thead>
                    <tbody>
                        {unplaced.map((note) => (
                            <tr key={note.id}>
                                <td>
                                    <button type="button" className="pc-row-main" onClick={() => setOpenId(note.id)}>
                                        <strong>{displayTitle(note)}</strong>
                                        <span className="pc-muted">{bodyPreview(note)}</span>
                                    </button>
                                </td>
                                <td>
                                    <SuggestionBadge
                                        note={note}
                                        notes={notes}
                                        onAsk={() => api.askAi(note.id)}
                                        onConfirm={() => api.confirmSuggestion(note.id)}
                                        onReject={() => api.rejectSuggestion(note.id)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
