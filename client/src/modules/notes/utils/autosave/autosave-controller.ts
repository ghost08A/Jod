import { shouldConfirmBeforeSwitchingNote, type AutosaveStatus } from './autosave-decisions'
import {
    createInitialAutosaveState,
    transitionAutosave,
    type AutosaveCommand,
    type AutosaveEvent,
    type AutosaveTimerKind,
    type AutosaveTransition,
} from './autosave-machine'
import { isConflictEquivalentToSaved, type NoteSnapshot, type ServerNoteVersion } from './conflict-equivalence'
import type { SaveFailureCause } from './retry-policy'
import { sanitizeNoteSnapshot } from './sanitize-note-snapshot'
import { planPageLeaving, toSaveErrorEvent, toSaveNoteBody } from './save-request'

/** What the status indicator needs to know */
export type AutosaveView = {
    status: AutosaveStatus
    failureReason: SaveFailureCause | undefined
    /** The note was too big to send while the page was hidden, so it is still waiting for a normal save */
    isTooLargeForKeepalive: boolean
    /** The check of the latest note (needed after a keepalive save) failed; a retry asks again */
    hasRefetchFailed: boolean
    /** The text the title, context and editor start from. Replaced when a newer note was loaded from the server */
    loadedNote: NoteSnapshot
    /** Goes up by one each time loadedNote is replaced, so the page can open the fields and editor again */
    loadedRevision: number
}

type AutosaveControllerOptions = {
    initialNote: ServerNoteVersion
    /** PUT the note. keepalive lets the request finish while the page closes */
    saveNote: (body: ReturnType<typeof toSaveNoteBody>, keepalive: boolean) => Promise<{ version: number }>
    fetchLatestNote: () => Promise<ServerNoteVersion>
    onViewChange: (view: AutosaveView) => void
    /** Called while some text is not saved yet, so the session can be renewed before it runs out */
    keepSessionFresh?: () => void
}

const TIMER_EVENTS = {
    debounce: 'debounceTimerFired',
    maxWait: 'maxWaitTimerFired',
    retry: 'retryTimerFired',
} as const

/**
 * Runs the autosave machine against real timers and requests. It holds the machine state, carries out its
 * commands and turns every answer into the next event. Note content is never logged.
 */
export function createAutosaveController({
    initialNote,
    saveNote,
    fetchLatestNote,
    onViewChange,
    keepSessionFresh,
}: AutosaveControllerOptions) {
    let state = createInitialAutosaveState(initialNote)
    const timers: Partial<Record<AutosaveTimerKind, ReturnType<typeof setTimeout>>> = {}
    let isTooLargeForKeepalive = false
    let hasRefetchFailed = false
    let isRefetching = false
    let isDisposed = false
    let loadedNote: NoteSnapshot = state.currentSnapshot
    let loadedRevision = 0

    function publish() {
        if (state.status === 'saved' || state.status === 'idle') isTooLargeForKeepalive = false
        if (shouldConfirmBeforeSwitchingNote(state.status)) keepSessionFresh?.()
        onViewChange({
            status: state.status,
            failureReason: state.failureReason,
            isTooLargeForKeepalive,
            hasRefetchFailed,
            loadedNote,
            loadedRevision,
        })
    }

    function apply(transition: AutosaveTransition) {
        state = transition.state
        publish()
        transition.commands.forEach(run)
    }

    function dispatch(event: AutosaveEvent) {
        if (isDisposed) return
        const previousSnapshot = state.currentSnapshot
        const transition = transitionAutosave(state, event)
        const nextSnapshot = transition.state.currentSnapshot
        // Note: only an edit changes the text from the screen; any other change came from the server and must be shown
        if (
            event.type !== 'contentEdited' &&
            nextSnapshot !== previousSnapshot &&
            !isConflictEquivalentToSaved(nextSnapshot, previousSnapshot)
        ) {
            loadedNote = nextSnapshot
            loadedRevision += 1
        }
        apply(transition)
    }

    function clearTimer(kind: AutosaveTimerKind) {
        clearTimeout(timers[kind])
        delete timers[kind]
    }

    async function sendSave(snapshot: NoteSnapshot, baseVersion: number, keepalive: boolean) {
        const body = toSaveNoteBody(snapshot, baseVersion)
        if (keepalive) {
            // Note: by design the result of a keepalive save is unknown; the machine fetches the note before the next save
            saveNote(body, true).catch(() => undefined)
            return
        }
        try {
            const saved = await saveNote(body, false)
            dispatch({ type: 'saveSucceeded', newVersion: saved.version, nowMs: Date.now() })
        } catch (error) {
            dispatch(toSaveErrorEvent(error, Date.now()))
        }
    }

    async function refetch(reason: 'afterKeepalive' | 'tabReturn') {
        // Note: one check at a time; the answer of the running one serves every request for it
        if (isRefetching) return
        isRefetching = true
        try {
            const serverNote = await fetchLatestNote()
            isRefetching = false
            dispatch({ type: 'refetchSucceeded', serverNote, nowMs: Date.now() })
        } catch {
            isRefetching = false
            // Note: a failed silent refresh of an untouched tab changes nothing; the note on screen is still the saved one
            if (reason === 'tabReturn' || isDisposed) return
            // ponytail: the machine has no "refetch failed" event, so this flag shows the failure and a retry asks again
            hasRefetchFailed = true
            publish()
        }
    }

    function run(command: AutosaveCommand) {
        switch (command.type) {
            case 'setTimer': {
                clearTimer(command.timer)
                const event = TIMER_EVENTS[command.timer]
                timers[command.timer] = setTimeout(() => {
                    delete timers[command.timer]
                    dispatch({ type: event, nowMs: Date.now() })
                }, command.delayMs)
                return
            }
            case 'cancelTimer':
                clearTimer(command.timer)
                return
            case 'sendSaveRequest':
                void sendSave(command.snapshot, command.baseVersion, command.keepalive === true)
                return
            case 'refetchLatestNote':
                void refetch(command.reason)
                return
            case 'confirmNoteSwitch':
                // Note: answered by requestNoteSwitch, which the page asks synchronously before it navigates
                return
        }
    }

    return {
        /** Call after any change to the title, context or content; the other parts keep their latest value */
        edit(change: Partial<NoteSnapshot>) {
            hasRefetchFailed = false
            const snapshot = sanitizeNoteSnapshot({ ...state.currentSnapshot, ...change })
            dispatch({ type: 'contentEdited', snapshot, nowMs: Date.now() })
        },
        /** The page is hidden or closed: send the last text with keepalive when it fits */
        leavePage() {
            if (isDisposed) return
            const plan = planPageLeaving(state, Date.now())
            if (plan === undefined) return
            if (plan === 'tooLarge') {
                isTooLargeForKeepalive = true
                publish()
                return
            }
            apply(plan)
        },
        returnToPage() {
            dispatch({ type: 'tabReturned' })
        },
        retry() {
            hasRefetchFailed = false
            dispatch({ type: 'manualRetryRequested', nowMs: Date.now() })
        },
        getStatus(): AutosaveStatus {
            return state.status
        },
        /** The latest text as the user sees it (cleaned), for copying it out */
        getCurrentSnapshot(): NoteSnapshot {
            return state.currentSnapshot
        },
        /** True when leaving this note now could lose text, so the user should be asked first */
        requestNoteSwitch(target: string): boolean {
            const { commands } = transitionAutosave(state, { type: 'noteSwitchRequested', targetNoteId: target })
            return commands.some((command) => command.type === 'confirmNoteSwitch')
        },
        /** Stops timers and ignores answers that arrive later */
        dispose() {
            isDisposed = true
            for (const kind of Object.keys(timers) as AutosaveTimerKind[]) clearTimer(kind)
        },
    }
}
