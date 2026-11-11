import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import { sessionCoordinator } from '../../auth/services/browser-session'
import { createNote, getNote, saveNote } from '../services/note-service'
import type { ConflictCopyResult, ConflictSide, CopyResult } from '../types/conflict'
import type { Note } from '../types/note'
import { createAutosaveController, type AutosaveView } from '../utils/autosave/autosave-controller'
import { shouldConfirmBeforeSwitchingNote } from '../utils/autosave/autosave-decisions'
import { normalizeNoteSnapshot, type NoteSnapshot } from '../utils/autosave/conflict-equivalence'
import { noteToPlainText } from '../utils/autosave/note-plain-text'
import { isSessionCloseToExpiry } from '../utils/autosave/save-request'
import type { NoteDocument } from '../utils/editor/block-document'

const LEAVE_NOTE_MESSAGE = 'โน้ตนี้ยังบันทึกไม่เสร็จ ถ้าออกตอนนี้ ข้อความล่าสุดอาจหายได้ ต้องการออกจากโน้ตนี้หรือไม่'

/** Renews the session in the background when its token is about to run out; a refusal is handled by the sign-in flow */
function keepSessionFresh() {
    const session = sessionCoordinator.getCurrent()
    if (!session || !isSessionCloseToExpiry(session.expiresAt, Date.now())) return
    // Note: passing the current token forces a renewal; if another tab already renewed, the lock hands that one back
    sessionCoordinator.refresh(session.accessToken).catch(() => undefined)
}

async function writeToClipboard(text: string): Promise<CopyResult> {
    try {
        await navigator.clipboard.writeText(text)
        return 'copied'
    } catch {
        return 'refused'
    }
}

/** Saves the open note by itself (see utils/autosave). This hook only connects it to the browser, the router and the API */
export function useAutosave(note: Note, refreshNoteList: () => void) {
    const [view, setView] = useState<AutosaveView>(() => ({
        status: 'idle',
        failureReason: undefined,
        isTooLargeForKeepalive: false,
        hasRefetchFailed: false,
        loadedNote: normalizeNoteSnapshot(note),
        loadedRevision: 0,
        conflictServerNote: undefined,
        conflictLimitReached: false,
        conflictMyNote: undefined,
        isResolvingConflict: false,
    }))
    const [copyResult, setCopyResult] = useState<CopyResult | undefined>(undefined)
    const [sideCopyResult, setSideCopyResult] = useState<ConflictCopyResult | undefined>(undefined)
    const [keepBothState, setKeepBothState] = useState<'working' | 'failed' | undefined>(undefined)
    const controllerRef = useRef<ReturnType<typeof createAutosaveController>>(undefined)

    useEffect(() => {
        const controller = createAutosaveController({
            initialNote: note,
            saveNote: (body, keepalive) => saveNote(note.id, body, keepalive),
            fetchLatestNote: () => getNote(note.id),
            onViewChange: setView,
            keepSessionFresh,
            createNote,
            saveOtherNote: saveNote,
            refreshNoteList,
        })
        controllerRef.current = controller

        // Note: pagehide as well as visibilitychange, because some phones never fire beforeunload or unload
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') controller.leavePage()
            else controller.returnToPage()
        }
        const handlePageHide = () => controller.leavePage()
        // Note: the browser shows its own wording; the dialog only appears while text could still be lost
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!shouldConfirmBeforeSwitchingNote(controller.getStatus())) return
            event.preventDefault()
            event.returnValue = ''
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('pagehide', handlePageHide)
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('pagehide', handlePageHide)
            window.removeEventListener('beforeunload', handleBeforeUnload)
            // Note: opening another note or page inside the app also sends the last text, the same way as closing the tab
            controller.leavePage()
            controller.dispose()
            controllerRef.current = undefined
        }
    }, [note, refreshNoteList])

    // Note: covers the note list, the drawer, New note and the browser back button. Going to /login is never
    // blocked: the session is gone and the sign-in page replaces this one whatever the answer
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            currentLocation.pathname !== nextLocation.pathname &&
            nextLocation.pathname !== '/login' &&
            (controllerRef.current?.requestNoteSwitch(nextLocation.pathname) ?? false),
    )
    useEffect(() => {
        if (blocker.state !== 'blocked') return
        if (window.confirm(LEAVE_NOTE_MESSAGE)) blocker.proceed()
        else blocker.reset()
    }, [blocker])

    const editTitle = useCallback((title: string) => controllerRef.current?.edit({ title }), [])
    const editContext = useCallback((context: string) => controllerRef.current?.edit({ context }), [])
    const editContent = useCallback((content: NoteDocument) => controllerRef.current?.edit({ content }), [])
    const retry = useCallback(() => {
        setCopyResult(undefined)
        controllerRef.current?.retry()
    }, [])
    const copyContent = useCallback(async () => {
        const snapshot = controllerRef.current?.getCurrentSnapshot()
        if (!snapshot) return
        setCopyResult(await writeToClipboard(noteToPlainText(snapshot)))
    }, [])

    const copySide = useCallback(async (side: ConflictSide) => {
        const snapshot: NoteSnapshot | undefined = side === 'mine' ? view.conflictMyNote : view.conflictServerNote
        if (!snapshot) return
        setSideCopyResult({ side, result: await writeToClipboard(noteToPlainText(snapshot)) })
    }, [view.conflictMyNote, view.conflictServerNote])
    const keepMine = useCallback(() => controllerRef.current?.keepMine(), [])
    const takeTheirs = useCallback(() => controllerRef.current?.takeTheirs(), [])
    const keepBoth = useCallback(async () => {
        setKeepBothState('working')
        const isDone = await (controllerRef.current?.keepBoth() ?? Promise.resolve(false))
        setKeepBothState(isDone ? undefined : 'failed')
    }, [])

    return {
        view,
        copyResult,
        editTitle,
        editContext,
        editContent,
        retry,
        copyContent,
        conflict: { sideCopyResult, keepBothState, copySide, keepMine, takeTheirs, keepBoth },
    }
}
