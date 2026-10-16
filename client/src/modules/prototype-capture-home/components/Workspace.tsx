import { useEffect, useState, type CSSProperties } from 'react'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import { NoteCanvas, type SlashConfig } from './NoteCanvas'
import { Sidebar } from './Sidebar'

export interface LayoutConfig {
    sidebarWidth: number
    contentMaxWidth: number
    titleSize: number
    topSpace: number
    align: 'center' | 'start'
}

interface WorkspaceProps {
    api: PrototypeNotesApi
    layout: LayoutConfig
    slash: SlashConfig
}

export function Workspace({ api, layout, slash }: WorkspaceProps) {
    const [openId, setOpenId] = useState<string | undefined>('meeting')
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 720)
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

    const style = {
        '--pc-sidebar': `${layout.sidebarWidth}px`,
        '--pc-content-max': `${layout.contentMaxWidth}px`,
        '--pc-title-size': `${layout.titleSize}px`,
        '--pc-top-space': `${layout.topSpace}px`,
        '--pc-column-margin': layout.align === 'center' ? 'auto' : '0 auto 0 96px',
    } as CSSProperties

    return (
        <div className={`pc-ws ${sidebarOpen ? '' : 'is-collapsed'}`} style={style}>
            <aside className="pc-sidebar-wrap">
                <Sidebar notes={api.notes} openId={openId} onNew={newNote} onOpen={openNote} />
            </aside>
            <main className="pc-main">
                {open ? (
                    <NoteCanvas key={open.id} note={open} api={api} slash={slash} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                ) : (
                    <button type="button" className="pc-quiet pc-toggle pc-toggle-floating" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
                )}
            </main>
        </div>
    )
}
