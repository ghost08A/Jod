import { useEffect, useState, type RefObject } from 'react'
import { Link } from 'react-router'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { useSignOut } from '../../auth/hooks/useSignOut'
import { useNoteList } from '../hooks/useNoteList'
import { nextFocusIndex } from '../utils/shell/next-focus-index'
import { NewNoteButton } from './NewNoteButton'
import { NoteList } from './NoteList'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])'

type NoteSidebarProps = {
    isDrawer: boolean
    isOpen: boolean
    /** The element that opened the drawer, which gets focus back when the drawer closes */
    openerRef: RefObject<HTMLElement | null>
    /** Closes the drawer. Must keep the same identity between renders */
    onClose: () => void
    /** The note list; NotesWorkspace owns it so the open note's page can ask for a refresh too */
    noteList: ReturnType<typeof useNoteList>
}

export function NoteSidebar({ isDrawer, isOpen, openerRef, onClose, noteList }: NoteSidebarProps) {
    const [panel, setPanel] = useState<HTMLElement | null>(null)
    const { items, error, isLoading, refresh, retry } = noteList
    const isModal = isDrawer && isOpen
    useDrawerBehavior(isModal ? panel : null, openerRef, onClose)

    // Note: choosing a note or creating one closes the drawer; on a wide screen nothing closes
    function handleNavigated() {
        if (isDrawer) onClose()
    }

    return (
        <aside
            id="notes-sidebar"
            ref={setPanel}
            className="notes-sidebar"
            data-open={isOpen}
            aria-label="รายการโน้ต"
            role={isModal ? 'dialog' : undefined}
            aria-modal={isModal || undefined}
            inert={!isOpen}
        >
            <div className="notes-sidebar-header">
                <NewNoteButton
                    onCreated={() => {
                        refresh()
                        handleNavigated()
                    }}
                />
                {isDrawer && (
                    <button className="notes-icon-button" type="button" onClick={onClose} aria-label="ปิดแถบข้าง">
                        ×
                    </button>
                )}
            </div>
            <nav className="notes-sidebar-nav" aria-label="โน้ตของฉัน">
                <NoteList items={items} error={error} isLoading={isLoading} onRetry={retry} onSelect={handleNavigated} />
            </nav>
            <SidebarFooter />
        </aside>
    )
}

/** While the drawer is open (panel is set): Escape closes it, Tab stays inside, the page behind cannot scroll, focus goes back to the opener */
function useDrawerBehavior(panel: HTMLElement | null, openerRef: RefObject<HTMLElement | null>, onClose: () => void) {
    useEffect(() => {
        if (!panel) return
        const opener = openerRef.current
        const getFocusable = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

        getFocusable()[0]?.focus()
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
            }
            if (event.key !== 'Tab') return
            const focusable = getFocusable()
            const currentIndex = focusable.findIndex((element) => element === document.activeElement)
            const nextIndex = nextFocusIndex(focusable.length, currentIndex, event.shiftKey)
            event.preventDefault()
            focusable[nextIndex]?.focus()
        }
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = previousOverflow
            opener?.focus()
        }
    }, [panel, openerRef, onClose])
}

function SidebarFooter() {
    const { user, error } = useCurrentUser()
    const { signOut, isSigningOut, error: signOutError } = useSignOut()
    const shownError = error ?? signOutError

    return (
        <div className="notes-sidebar-footer">
            {user ? (
                <Link className="notes-account-link" to="/account">
                    {user.email}
                </Link>
            ) : (
                !error && <span className="skeleton" aria-label="กำลังโหลด" role="status" />
            )}
            {shownError && <ErrorMessage styleScope="notes" message={shownError.message} reference={shownError.reference} />}
            <button className="notes-secondary-button" type="button" onClick={signOut} disabled={isSigningOut} aria-busy={isSigningOut}>
                {isSigningOut && <span className="spinner" aria-hidden="true" />}
                {isSigningOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
            </button>
        </div>
    )
}
