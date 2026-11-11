import { ApiError } from '../../../../core/http/api-error'
import {
    transitionAutosave,
    type AutosaveEvent,
    type AutosaveMachineState,
    type AutosaveTransition,
} from './autosave-machine'
import { isConflictEquivalentToSaved, type NoteSnapshot, type ServerNoteVersion } from './conflict-equivalence'

/**
 * Browsers refuse a keepalive request once all keepalive bodies still in flight pass about 64 KiB.
 * Note: the spec lists the real limit as not yet checked in every browser (manual check of ticket #21)
 */
export const KEEPALIVE_BODY_LIMIT_BYTES = 64 * 1024

const UNKNOWN_SAVE_MESSAGE = 'บันทึกไม่สำเร็จ ลองอีกครั้ง'

/** The body of PUT /api/notes/{id}: the whole note plus the version this tab last saw */
export function toSaveNoteBody(snapshot: NoteSnapshot, baseVersion: number): NoteSnapshot & { baseVersion: number } {
    return { title: snapshot.title, context: snapshot.context, content: snapshot.content, baseVersion }
}

/** Measures the body as it is sent (JSON in UTF-8), not in JavaScript string length */
export function fitsKeepaliveLimit(body: unknown): boolean {
    return new TextEncoder().encode(JSON.stringify(body)).length <= KEEPALIVE_BODY_LIMIT_BYTES
}

/**
 * What to do when the page is hidden or closed:
 * - undefined: nothing to send, or the same text already went out in a keepalive (pagehide follows visibilitychange)
 * - 'tooLarge': the note does not fit a keepalive request; keep the normal autosave going and tell the user
 * - a transition: apply it; its commands include the keepalive save
 */
export function planPageLeaving(
    state: AutosaveMachineState,
    nowMs: number,
): AutosaveTransition | 'tooLarge' | undefined {
    if (
        state.requiresRefetchBeforeSave &&
        state.keepaliveSnapshot !== undefined &&
        isConflictEquivalentToSaved(state.currentSnapshot, state.keepaliveSnapshot)
    ) {
        return undefined
    }

    const transition = transitionAutosave(state, { type: 'pageLeaving', nowMs })
    const keepaliveSave = transition.commands.find((command) => command.type === 'sendSaveRequest')
    if (keepaliveSave === undefined) return undefined
    if (!fitsKeepaliveLimit(toSaveNoteBody(keepaliveSave.snapshot, keepaliveSave.baseVersion))) return 'tooLarge'
    return transition
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function readServerNote(payload: unknown): ServerNoteVersion | undefined {
    if (!isRecord(payload)) return undefined
    const { version, title, context, content } = payload
    if (typeof version !== 'number' || typeof title !== 'string' || typeof context !== 'string') return undefined
    if (!('content' in payload)) return undefined
    return { version, title, context, content }
}

/** Turns a failed save into the machine event: 409 with the server's note is a conflict, the rest are failures */
export function toSaveErrorEvent(error: unknown, nowMs: number): AutosaveEvent {
    if (!(error instanceof ApiError)) {
        return { type: 'saveFailed', failure: { kind: 'network', message: UNKNOWN_SAVE_MESSAGE }, nowMs }
    }

    const { status, message, reference } = error
    if (status === 409) {
        const serverNote = readServerNote(error.extensions.payload)
        if (serverNote) return { type: 'saveConflicted', serverNote, nowMs }
    }
    if (status === 0) return { type: 'saveFailed', failure: { kind: 'network', message, reference }, nowMs }
    if (status === 408) return { type: 'saveFailed', failure: { kind: 'timeout', message, reference }, nowMs }
    return { type: 'saveFailed', failure: { kind: 'http', status, message, reference }, nowMs }
}

/**
 * Renew the session this long before the access token runs out while text is unsaved. A keepalive save sent as
 * the page closes cannot wait for a renewal after a 401, so the token must still be good when it leaves.
 * Note: access tokens live 15 minutes (backend JwtOptions.AccessTokenMinutes)
 */
export const SESSION_RENEW_MARGIN_MS = 2 * 60_000

export function isSessionCloseToExpiry(expiresAtMs: number, nowMs: number): boolean {
    return expiresAtMs - nowMs <= SESSION_RENEW_MARGIN_MS
}
