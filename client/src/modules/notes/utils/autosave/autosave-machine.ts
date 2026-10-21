import {
    hasReachedConflictRetryLimit,
    shouldConfirmBeforeSwitchingNote,
    shouldRefetchOnTabReturn,
    type AutosaveStatus,
} from './autosave-decisions'
import {
    isConflictEquivalentToSaved,
    normalizeNoteSnapshot,
    type NoteSnapshot,
    type ServerNoteVersion,
} from './conflict-equivalence'
import { getRetryDelayMs, isTransientSaveFailure, type SaveFailureCause } from './retry-policy'

export const DEBOUNCE_DELAY_MS = 1_000
export const MAX_WAIT_DELAY_MS = 10_000

export type AutosaveTimerKind = 'debounce' | 'maxWait' | 'retry'

export type AutosaveCommand =
    | {
          type: 'setTimer'
          timer: AutosaveTimerKind
          delayMs: number
          dueAtMs: number
      }
    | {
          type: 'cancelTimer'
          timer: AutosaveTimerKind
      }
    | {
          type: 'sendSaveRequest'
          snapshot: NoteSnapshot
          baseVersion: number
          keepalive?: boolean
      }
    | {
          type: 'refetchLatestNote'
          reason: 'afterKeepalive' | 'tabReturn'
      }
    | {
          type: 'confirmNoteSwitch'
          targetNoteId: string
      }

export type AutosaveEvent =
    | {
          type: 'contentEdited'
          snapshot: NoteSnapshot
          nowMs: number
      }
    | {
          type: 'debounceTimerFired'
          nowMs: number
      }
    | {
          type: 'maxWaitTimerFired'
          nowMs: number
      }
    | {
          type: 'retryTimerFired'
          nowMs: number
      }
    | {
          type: 'saveSucceeded'
          newVersion: number
          nowMs: number
      }
    | {
          type: 'saveFailed'
          failure: SaveFailureCause
          nowMs: number
      }
    | {
          type: 'saveConflicted'
          serverNote: ServerNoteVersion
          nowMs: number
      }
    | {
          type: 'pageLeaving'
          nowMs: number
      }
    | {
          type: 'keepaliveSent'
          snapshot?: NoteSnapshot
      }
    | {
          type: 'tabReturned'
      }
    | {
          type: 'refetchSucceeded'
          serverNote: ServerNoteVersion
          nowMs: number
      }
    | {
          type: 'noteSwitchRequested'
          targetNoteId: string
      }
    | {
          type: 'manualRetryRequested'
          nowMs: number
      }
    | {
          type: 'conflictUseMineRequested'
          nowMs: number
      }
    | {
          type: 'conflictUseTheirsAccepted'
          serverNote: ServerNoteVersion
      }

export type AutosaveMachineState = {
    status: AutosaveStatus
    baseVersion: number
    lastSavedSnapshot: NoteSnapshot
    currentSnapshot: NoteSnapshot
    inFlightSnapshot: NoteSnapshot | undefined
    keepaliveSnapshot: NoteSnapshot | undefined
    dirtySinceMs: number | undefined
    debounceDueAtMs: number | undefined
    maxWaitDueAtMs: number | undefined
    retryAttempt: number
    retryDueAtMs: number | undefined
    failureReason: SaveFailureCause | undefined
    conflictServerNote: ServerNoteVersion | undefined
    conflictRetryCount: number
    conflictLimitReached: boolean
    requiresRefetchBeforeSave: boolean
    pendingSaveAfterRefetch: boolean
    isConflictResolutionSave: boolean
}

export type AutosaveTransition = {
    state: AutosaveMachineState
    commands: AutosaveCommand[]
}

export function createInitialAutosaveState(initialNote: ServerNoteVersion): AutosaveMachineState {
    const normalized = normalizeNoteSnapshot(initialNote)
    return {
        status: 'idle',
        baseVersion: initialNote.version,
        lastSavedSnapshot: normalized,
        currentSnapshot: normalized,
        inFlightSnapshot: undefined,
        keepaliveSnapshot: undefined,
        dirtySinceMs: undefined,
        debounceDueAtMs: undefined,
        maxWaitDueAtMs: undefined,
        retryAttempt: 0,
        retryDueAtMs: undefined,
        failureReason: undefined,
        conflictServerNote: undefined,
        conflictRetryCount: 0,
        conflictLimitReached: false,
        requiresRefetchBeforeSave: false,
        pendingSaveAfterRefetch: false,
        isConflictResolutionSave: false,
    }
}

function hasUnsavedChanges(state: AutosaveMachineState, candidateSnapshot = state.currentSnapshot): boolean {
    return !isConflictEquivalentToSaved(candidateSnapshot, state.lastSavedSnapshot)
}

function cancelActiveTimers(state: AutosaveMachineState, commands: AutosaveCommand[]): AutosaveMachineState {
    let nextState = state
    if (nextState.debounceDueAtMs !== undefined) {
        commands.push({ type: 'cancelTimer', timer: 'debounce' })
        nextState = { ...nextState, debounceDueAtMs: undefined }
    }
    if (nextState.maxWaitDueAtMs !== undefined) {
        commands.push({ type: 'cancelTimer', timer: 'maxWait' })
        nextState = { ...nextState, maxWaitDueAtMs: undefined }
    }
    if (nextState.retryDueAtMs !== undefined) {
        commands.push({ type: 'cancelTimer', timer: 'retry' })
        nextState = { ...nextState, retryDueAtMs: undefined }
    }
    return nextState
}

function startSaveOrRefetch(
    state: AutosaveMachineState,
    commands: AutosaveCommand[],
    isConflictResolution = false,
): AutosaveTransition {
    const cleanedState = cancelActiveTimers(state, commands)

    // Note: after a keepalive request on tab hide/leave, the server result is unknown, so we must fetch first
    if (cleanedState.requiresRefetchBeforeSave) {
        commands.push({ type: 'refetchLatestNote', reason: 'afterKeepalive' })
        return {
            state: {
                ...cleanedState,
                status: 'unsaved',
                pendingSaveAfterRefetch: true,
            },
            commands,
        }
    }

    const snapshotToSend = normalizeNoteSnapshot(cleanedState.currentSnapshot)
    commands.push({
        type: 'sendSaveRequest',
        snapshot: snapshotToSend,
        baseVersion: cleanedState.baseVersion,
    })

    return {
        state: {
            ...cleanedState,
            status: 'saving',
            inFlightSnapshot: snapshotToSend,
            dirtySinceMs: undefined,
            failureReason: undefined,
            isConflictResolutionSave: isConflictResolution,
        },
        commands,
    }
}

function completeSaveSuccess(
    state: AutosaveMachineState,
    savedSnapshot: NoteSnapshot,
    newVersion: number,
): AutosaveTransition {
    const commands: AutosaveCommand[] = []
    const normalizedSaved = normalizeNoteSnapshot(savedSnapshot)
    const updatedBaseState: AutosaveMachineState = {
        ...state,
        baseVersion: newVersion,
        lastSavedSnapshot: normalizedSaved,
        inFlightSnapshot: undefined,
        keepaliveSnapshot: undefined,
        retryAttempt: 0,
        retryDueAtMs: undefined,
        failureReason: undefined,
        conflictServerNote: undefined,
        conflictRetryCount: 0,
        conflictLimitReached: false,
        isConflictResolutionSave: false,
    }

    // Note: if the user edited the note while the save request was in flight, do not show "saved" yet
    if (!isConflictEquivalentToSaved(updatedBaseState.currentSnapshot, normalizedSaved)) {
        return startSaveOrRefetch(updatedBaseState, commands)
    }

    const cleanedState = cancelActiveTimers(updatedBaseState, commands)
    return {
        state: {
            ...cleanedState,
            status: 'saved',
            dirtySinceMs: undefined,
        },
        commands,
    }
}

export function transitionAutosave(
    state: AutosaveMachineState,
    event: AutosaveEvent,
): AutosaveTransition {
    const commands: AutosaveCommand[] = []

    switch (event.type) {
        case 'contentEdited': {
            if (state.status === 'conflict') {
                return { state, commands }
            }

            const nextStateWithContent: AutosaveMachineState = {
                ...state,
                currentSnapshot: event.snapshot,
            }

            // Note: only one save request runs at a time; edits during save are sent right after it finishes
            if (state.status === 'saving') {
                return { state: nextStateWithContent, commands }
            }

            // Note: while waiting for a retry timer, keep the timer and send the latest content when it fires
            if (state.status === 'retrying') {
                return { state: nextStateWithContent, commands }
            }

            const dirtySinceMs = state.dirtySinceMs ?? event.nowMs
            const elapsedDirtyMs = event.nowMs - dirtySinceMs

            if (elapsedDirtyMs >= MAX_WAIT_DELAY_MS) {
                return startSaveOrRefetch(
                    {
                        ...nextStateWithContent,
                        dirtySinceMs,
                    },
                    commands,
                )
            }

            if (state.debounceDueAtMs !== undefined) {
                commands.push({ type: 'cancelTimer', timer: 'debounce' })
            }

            const debounceDueAtMs = event.nowMs + DEBOUNCE_DELAY_MS
            commands.push({
                type: 'setTimer',
                timer: 'debounce',
                delayMs: DEBOUNCE_DELAY_MS,
                dueAtMs: debounceDueAtMs,
            })

            let maxWaitDueAtMs = state.maxWaitDueAtMs
            if (maxWaitDueAtMs === undefined) {
                maxWaitDueAtMs = dirtySinceMs + MAX_WAIT_DELAY_MS
                commands.push({
                    type: 'setTimer',
                    timer: 'maxWait',
                    delayMs: MAX_WAIT_DELAY_MS,
                    dueAtMs: maxWaitDueAtMs,
                })
            }

            return {
                state: {
                    ...nextStateWithContent,
                    status: 'unsaved',
                    dirtySinceMs,
                    debounceDueAtMs,
                    maxWaitDueAtMs,
                    failureReason: undefined,
                },
                commands,
            }
        }

        case 'debounceTimerFired':
        case 'maxWaitTimerFired': {
            if (state.status !== 'unsaved') {
                return { state, commands }
            }
            if (!hasUnsavedChanges(state) && !state.requiresRefetchBeforeSave) {
                const cleaned = cancelActiveTimers(state, commands)
                return {
                    state: {
                        ...cleaned,
                        status: 'idle',
                        dirtySinceMs: undefined,
                    },
                    commands,
                }
            }
            return startSaveOrRefetch(state, commands)
        }

        case 'retryTimerFired': {
            if (state.status !== 'retrying') {
                return { state, commands }
            }
            return startSaveOrRefetch(
                {
                    ...state,
                    retryDueAtMs: undefined,
                },
                commands,
                state.isConflictResolutionSave,
            )
        }

        case 'saveSucceeded': {
            if (state.status !== 'saving' || state.inFlightSnapshot === undefined) {
                return { state, commands }
            }
            return completeSaveSuccess(state, state.inFlightSnapshot, event.newVersion)
        }

        case 'saveFailed': {
            if (state.status !== 'saving') {
                return { state, commands }
            }

            const baseAfterFailure: AutosaveMachineState = {
                ...state,
                inFlightSnapshot: undefined,
                failureReason: event.failure,
            }

            if (isTransientSaveFailure(event.failure)) {
                const nextAttempt = state.retryAttempt + 1
                const retryDelayMs = getRetryDelayMs(nextAttempt)
                if (retryDelayMs !== undefined) {
                    const retryDueAtMs = event.nowMs + retryDelayMs
                    commands.push({
                        type: 'setTimer',
                        timer: 'retry',
                        delayMs: retryDelayMs,
                        dueAtMs: retryDueAtMs,
                    })
                    return {
                        state: {
                            ...baseAfterFailure,
                            status: 'retrying',
                            retryAttempt: nextAttempt,
                            retryDueAtMs,
                        },
                        commands,
                    }
                }
            }

            const cleanedState = cancelActiveTimers(baseAfterFailure, commands)
            return {
                state: {
                    ...cleanedState,
                    status: 'failed',
                    retryAttempt: 0,
                    isConflictResolutionSave: false,
                },
                commands,
            }
        }

        case 'saveConflicted': {
            if (state.status !== 'saving' || state.inFlightSnapshot === undefined) {
                return { state, commands }
            }

            // Note: if the server already saved the exact snapshot we sent, treat the 409 as a success
            if (isConflictEquivalentToSaved(state.inFlightSnapshot, event.serverNote)) {
                return completeSaveSuccess(state, state.inFlightSnapshot, event.serverNote.version)
            }

            const cleanedState = cancelActiveTimers(state, commands)
            const nextConflictRetryCount = state.isConflictResolutionSave
                ? state.conflictRetryCount + 1
                : state.conflictRetryCount

            return {
                state: {
                    ...cleanedState,
                    status: 'conflict',
                    inFlightSnapshot: undefined,
                    retryAttempt: 0,
                    failureReason: undefined,
                    conflictServerNote: normalizeServerNote(event.serverNote),
                    conflictRetryCount: nextConflictRetryCount,
                    conflictLimitReached: hasReachedConflictRetryLimit(nextConflictRetryCount),
                    isConflictResolutionSave: false,
                },
                commands,
            }
        }

        case 'pageLeaving': {
            if (state.status === 'conflict') {
                return { state, commands }
            }

            const needsKeepalive =
                state.status === 'unsaved' ||
                state.status === 'retrying' ||
                state.status === 'failed' ||
                hasUnsavedChanges(state)

            if (!needsKeepalive) {
                return { state, commands }
            }

            const cleanedState = cancelActiveTimers(state, commands)
            const snapshotToSend = normalizeNoteSnapshot(cleanedState.currentSnapshot)

            commands.push({
                type: 'sendSaveRequest',
                snapshot: snapshotToSend,
                baseVersion: cleanedState.baseVersion,
                keepalive: true,
            })

            return {
                state: {
                    ...cleanedState,
                    status: 'unsaved',
                    inFlightSnapshot: undefined,
                    keepaliveSnapshot: snapshotToSend,
                    requiresRefetchBeforeSave: true,
                    pendingSaveAfterRefetch: false,
                },
                commands,
            }
        }

        case 'keepaliveSent': {
            const cleanedState = cancelActiveTimers(state, commands)
            const snapshotSent = normalizeNoteSnapshot(event.snapshot ?? cleanedState.currentSnapshot)
            return {
                state: {
                    ...cleanedState,
                    status: 'unsaved',
                    inFlightSnapshot: undefined,
                    keepaliveSnapshot: snapshotSent,
                    requiresRefetchBeforeSave: true,
                    pendingSaveAfterRefetch: false,
                },
                commands,
            }
        }

        case 'tabReturned': {
            if (state.requiresRefetchBeforeSave) {
                commands.push({ type: 'refetchLatestNote', reason: 'afterKeepalive' })
                return { state, commands }
            }

            if (shouldRefetchOnTabReturn(state.status)) {
                commands.push({ type: 'refetchLatestNote', reason: 'tabReturn' })
            }

            return { state, commands }
        }

        case 'refetchSucceeded': {
            const normalizedServer = normalizeServerNote(event.serverNote)
            const wasPendingSave = state.pendingSaveAfterRefetch
            const hadKeepalive = state.requiresRefetchBeforeSave

            const matchedPreviousBase = isConflictEquivalentToSaved(
                state.lastSavedSnapshot,
                normalizedServer,
            )
            const matchedKeepalive =
                state.keepaliveSnapshot !== undefined &&
                isConflictEquivalentToSaved(state.keepaliveSnapshot, normalizedServer)
            const matchedCurrent = isConflictEquivalentToSaved(
                state.currentSnapshot,
                normalizedServer,
            )

            const baseUpdatedState: AutosaveMachineState = {
                ...state,
                requiresRefetchBeforeSave: false,
                pendingSaveAfterRefetch: false,
                keepaliveSnapshot: undefined,
            }

            if (matchedCurrent) {
                const cleaned = cancelActiveTimers(baseUpdatedState, commands)
                return {
                    state: {
                        ...cleaned,
                        status: hadKeepalive || wasPendingSave ? 'saved' : state.status,
                        baseVersion: normalizedServer.version,
                        lastSavedSnapshot: normalizedServer,
                        currentSnapshot: normalizedServer,
                        dirtySinceMs: undefined,
                    },
                    commands,
                }
            }

            if (!hadKeepalive && shouldRefetchOnTabReturn(state.status)) {
                return {
                    state: {
                        ...baseUpdatedState,
                        baseVersion: normalizedServer.version,
                        lastSavedSnapshot: normalizedServer,
                        currentSnapshot: normalizedServer,
                    },
                    commands,
                }
            }

            if (matchedPreviousBase || matchedKeepalive || normalizedServer.version === state.baseVersion) {
                const reconciledState: AutosaveMachineState = {
                    ...baseUpdatedState,
                    baseVersion: normalizedServer.version,
                    lastSavedSnapshot: normalizedServer,
                }
                if (wasPendingSave || hasUnsavedChanges(reconciledState)) {
                    return startSaveOrRefetch(reconciledState, commands)
                }
                return { state: reconciledState, commands }
            }

            const cleaned = cancelActiveTimers(baseUpdatedState, commands)
            return {
                state: {
                    ...cleaned,
                    status: 'conflict',
                    conflictServerNote: normalizedServer,
                },
                commands,
            }
        }

        case 'noteSwitchRequested': {
            if (shouldConfirmBeforeSwitchingNote(state.status)) {
                commands.push({
                    type: 'confirmNoteSwitch',
                    targetNoteId: event.targetNoteId,
                })
            }
            return { state, commands }
        }

        case 'manualRetryRequested': {
            if (
                state.status !== 'failed' &&
                state.status !== 'retrying' &&
                state.status !== 'unsaved'
            ) {
                return { state, commands }
            }
            return startSaveOrRefetch(
                {
                    ...state,
                    retryAttempt: 0,
                    failureReason: undefined,
                },
                commands,
            )
        }

        case 'conflictUseMineRequested': {
            if (state.status !== 'conflict' || state.conflictServerNote === undefined) {
                return { state, commands }
            }

            if (hasReachedConflictRetryLimit(state.conflictRetryCount)) {
                return {
                    state: {
                        ...state,
                        conflictLimitReached: true,
                    },
                    commands,
                }
            }

            return startSaveOrRefetch(
                {
                    ...state,
                    baseVersion: state.conflictServerNote.version,
                    retryAttempt: 0,
                },
                commands,
                true,
            )
        }

        case 'conflictUseTheirsAccepted': {
            const normalizedServer = normalizeServerNote(event.serverNote)
            const cleanedState = cancelActiveTimers(state, commands)
            return {
                state: {
                    ...cleanedState,
                    status: 'idle',
                    baseVersion: normalizedServer.version,
                    lastSavedSnapshot: normalizedServer,
                    currentSnapshot: normalizedServer,
                    inFlightSnapshot: undefined,
                    keepaliveSnapshot: undefined,
                    dirtySinceMs: undefined,
                    retryAttempt: 0,
                    failureReason: undefined,
                    conflictServerNote: undefined,
                    conflictRetryCount: 0,
                    conflictLimitReached: false,
                    isConflictResolutionSave: false,
                },
                commands,
            }
        }
    }
}

function normalizeServerNote(serverNote: ServerNoteVersion): ServerNoteVersion {
    return {
        version: serverNote.version,
        title: normalizeNoteSnapshot(serverNote).title,
        context: serverNote.context,
        content: serverNote.content,
    }
}
