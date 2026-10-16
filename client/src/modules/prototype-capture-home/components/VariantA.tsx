import { useEffect, useState } from 'react'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import { bodyPreview, displayTitle, isEmptyDraft } from '../utils/note-label'
import { MovePicker } from './MovePicker'
import { NoteEditorFields } from './NoteEditorFields'
import { SuggestionBadge } from './SuggestionBadge'
import { TreeList } from './TreeList'

// Note: Variant A = sidebar (Tree + "รอจัดวาง" always visible) + Save bar docked at the bottom of the editor
export function VariantA({ api }: { api: PrototypeNotesApi }) {
    const [openId, setOpenId] = useState<string | undefined>()
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const { notes } = api
    const open = notes.find((note) => note.id === openId)
    const unplaced = notes.filter((note) => note.placement === 'unplaced' && !isEmptyDraft(note))

    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key === '\\') setSidebarOpen((current) => !current)
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [])

    function closeCurrent() {
        if (open?.isDraft) api.closeDraft(open.id)
        setOpenId(undefined)
    }

    function openNote(id: string) {
        if (open?.isDraft) api.closeDraft(open.id)
        setOpenId(id)
    }

    function newNote() {
        if (open?.isDraft) api.closeDraft(open.id)
        setOpenId(api.startDraft())
    }

    function save(choice: 'ai' | 'root' | 'unplaced') {
        if (!open) return
        api.saveDraft(open.id, choice)
        setOpenId(undefined)
    }

    return (
        <div className={`pc-a ${sidebarOpen ? '' : 'is-collapsed'}`}>
            <button
                type="button"
                className="pc-a-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'ซ่อนแถบด้านข้าง' : 'แสดงแถบด้านข้าง'}
                title="ซ่อน/แสดงแถบข้าง (Ctrl+\)"
            >☰</button>
            <aside className="pc-a-side">
                <button type="button" className="pc-primary pc-a-new" onClick={newNote}>+ New note</button>
                <h2 className="pc-heading">Tree</h2>
                <TreeList notes={notes} onOpen={openNote} openId={openId} />
                <h2 className="pc-heading">รอจัดวาง <span className="pc-count">{unplaced.length}</span></h2>
                <ul className="pc-list">
                    {unplaced.map((note) => (
                        <li key={note.id} className={`pc-a-unplaced ${openId === note.id ? 'is-open' : ''}`}>
                            <button type="button" className="pc-row-main" onClick={() => openNote(note.id)}>
                                <strong>{displayTitle(note)}</strong>
                                <span className="pc-muted">{bodyPreview(note)}</span>
                            </button>
                            {!note.isDraft && (
                                <SuggestionBadge
                                    note={note}
                                    notes={notes}
                                    onAsk={() => api.askAi(note.id)}
                                    onConfirm={() => api.confirmSuggestion(note.id)}
                                    onReject={() => api.rejectSuggestion(note.id)}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            </aside>
            <section className="pc-a-main">
                {!open && <p className="pc-empty">เลือก Note ทางซ้าย หรือกด + New note เพื่อจดทันที</p>}
                {open && (
                    <>
                        <NoteEditorFields note={open} onChange={(changes) => api.patch(open.id, changes)} autoFocus />
                        {open.isDraft ? (
                            <div className={`pc-a-savebar ${open.title || open.body.trim() ? '' : 'is-hidden'}`}>
                                <span>จัดวางที่ไหนดี?</span>
                                <button type="button" className="pc-primary" onClick={() => save('ai')}>✨ ให้ AI จัดให้</button>
                                <button type="button" className="pc-secondary" onClick={() => save('root')}>เป็นแม่ใหม่ (Root)</button>
                                <button type="button" className="pc-secondary" onClick={() => save('unplaced')}>ไว้ รอจัดวาง</button>
                                <button type="button" className="pc-link-button" onClick={closeCurrent}>ปิดไปก่อน</button>
                            </div>
                        ) : (
                            <div className="pc-a-savebar">
                                <MovePicker note={open} notes={notes} onMove={(parentId) => api.moveTo(open.id, parentId)} />
                                <button type="button" className="pc-link-button" onClick={closeCurrent}>ปิด</button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    )
}
