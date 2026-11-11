import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { Outlet } from 'react-router'
import { useNoteList } from '../hooks/useNoteList'
import { isDrawerViewport } from '../utils/shell/drawer-breakpoint'
import { NoteSidebar } from './NoteSidebar'
import './notes.css'

function subscribeToResize(onChange: () => void) {
    window.addEventListener('resize', onChange)
    return () => window.removeEventListener('resize', onChange)
}

function useIsDrawer() {
    return useSyncExternalStore(subscribeToResize, () => isDrawerViewport(window.innerWidth))
}

export function NotesWorkspace() {
    const isDrawer = useIsDrawer()
    const noteList = useNoteList()
    // Note: not saved anywhere, so every page load starts with the sidebar shown on a wide screen and closed as a drawer
    const [isWideSidebarOpen, setIsWideSidebarOpen] = useState(true)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const openerRef = useRef<HTMLButtonElement>(null)
    const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])

    // Note: a drawer left open must not come back open if the window is made narrow again
    if (!isDrawer && isDrawerOpen) setIsDrawerOpen(false)

    const isOpen = isDrawer ? isDrawerOpen : isWideSidebarOpen
    const isModalOpen = isDrawer && isDrawerOpen

    function handleToggle() {
        if (isDrawer) setIsDrawerOpen(true)
        else setIsWideSidebarOpen(!isWideSidebarOpen)
    }

    return (
        <div className="notes-workspace">
            <NoteSidebar isDrawer={isDrawer} isOpen={isOpen} openerRef={openerRef} onClose={closeDrawer} noteList={noteList} />
            {isModalOpen && <div className="notes-backdrop" onClick={closeDrawer} aria-hidden="true" />}
            <div className="notes-content" inert={isModalOpen}>
                <header className="notes-topbar">
                    <button
                        ref={openerRef}
                        className="notes-icon-button"
                        type="button"
                        onClick={handleToggle}
                        aria-label={isOpen ? 'ซ่อนรายการโน้ต' : 'แสดงรายการโน้ต'}
                        aria-expanded={isOpen}
                        aria-controls="notes-sidebar"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                        </svg>
                    </button>
                </header>
                <main className="notes-main">
                    <Outlet context={{ refreshNoteList: noteList.refresh, noteListItems: noteList.items }} />
                </main>
            </div>
        </div>
    )
}
