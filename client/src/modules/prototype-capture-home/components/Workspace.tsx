import { useEffect, useState, type CSSProperties } from 'react'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import type { ReviewChoice, ScenarioKind } from '../types/review-block'
import { displayTitle } from '../utils/note-label'
import { NoteCanvas } from './NoteCanvas'
import { ReviewScreen } from './ReviewScreen'
import { Sidebar } from './Sidebar'

// Note: layout C chosen in ticket 017
const LAYOUT_STYLE = {
    '--pc-sidebar': '300px',
    '--pc-content-max': '600px',
    '--pc-title-size': '52px',
    '--pc-top-space': '140px',
    '--pc-column-margin': '0 auto 0 96px',
} as CSSProperties

interface WorkspaceProps {
    api: PrototypeNotesApi
    scenario?: ScenarioKind
    reviewVariant: string
    onStartFormat: () => void
    onResolve: (choice: ReviewChoice, noteTitle: string) => void
}

export function Workspace({ api, scenario, reviewVariant, onStartFormat, onResolve }: WorkspaceProps) {
    const [openId, setOpenId] = useState<string | undefined>('meeting')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const open = api.notes.find((note) => note.id === openId)

    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key === '\\') setSidebarOpen((current) => !current)
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [])

    function leaveCurrent() {
        if (open?.isDraft) api.closeDraft(open.id)
    }

    function openNote(id: string) {
        leaveCurrent()
        setOpenId(id)
    }

    function newNote() {
        leaveCurrent()
        setOpenId(api.startDraft())
    }

    const noteTitle = open ? displayTitle(open) : 'ประชุมลูกค้า'

    return (
        <div className={`pc-ws ${sidebarOpen ? '' : 'is-collapsed'}`} style={LAYOUT_STYLE}>
            <aside className="pc-sidebar-wrap">
                <Sidebar notes={api.notes} openId={openId} onNew={newNote} onOpen={openNote} />
            </aside>
            <main className="pc-main">
                {scenario && (
                    <ReviewScreen
                        scenario={scenario}
                        variant={reviewVariant}
                        noteTitle={noteTitle}
                        onResolve={(choice) => onResolve(choice, noteTitle)}
                        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    />
                )}
                {!scenario && open && (
                    <NoteCanvas
                        key={open.id}
                        note={open}
                        api={api}
                        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                        onFormat={onStartFormat}
                    />
                )}
                {!scenario && !open && (
                    <button type="button" className="pc-quiet pc-toggle pc-toggle-floating" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
                )}
            </main>
        </div>
    )
}
