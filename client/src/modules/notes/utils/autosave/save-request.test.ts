import { describe, expect, it } from 'vitest'
import { ApiError, toConnectionError, toTimeoutError } from '../../../../core/http/api-error'
import { createInitialAutosaveState, transitionAutosave } from './autosave-machine'
import {
    fitsKeepaliveLimit,
    isSessionCloseToExpiry,
    KEEPALIVE_BODY_LIMIT_BYTES,
    planPageLeaving,
    toSaveErrorEvent,
} from './save-request'

const serverNote = {
    version: 3,
    title: 'Other tab',
    context: '',
    content: { schemaVersion: 1, blocks: [] },
}

function editedState(text: string) {
    const initial = createInitialAutosaveState({ version: 1, title: 'Note', context: '', content: { schemaVersion: 1, blocks: [] } })
    return transitionAutosave(initial, {
        type: 'contentEdited',
        snapshot: { title: 'Note', context: '', content: { schemaVersion: 1, blocks: [{ id: 'b', type: 'paragraph', text }] } },
        nowMs: 1_000,
    }).state
}

describe('toSaveErrorEvent', () => {
    it('maps offline to network, 408 to timeout and other statuses to http with message and reference', () => {
        expect(toSaveErrorEvent(toConnectionError(), 5)).toMatchObject({ type: 'saveFailed', failure: { kind: 'network' } })
        expect(toSaveErrorEvent(toTimeoutError(), 5)).toMatchObject({ type: 'saveFailed', failure: { kind: 'timeout' } })
        expect(toSaveErrorEvent(new ApiError(400, 'ข้อมูลไม่ถูกต้อง', 'REF-1'), 5)).toEqual({
            type: 'saveFailed',
            failure: { kind: 'http', status: 400, message: 'ข้อมูลไม่ถูกต้อง', reference: 'REF-1' },
            nowMs: 5,
        })
        expect(toSaveErrorEvent(new Error('parse'), 5)).toMatchObject({ type: 'saveFailed', failure: { kind: 'network' } })
    })

    it('turns a 409 into a conflict with the server note from payload, or a plain failure when payload is missing', () => {
        const withPayload = new ApiError(409, 'ชนกัน', 'REF-2', { payload: { id: 'n', ...serverNote } })
        expect(toSaveErrorEvent(withPayload, 7)).toEqual({ type: 'saveConflicted', serverNote, nowMs: 7 })
        expect(toSaveErrorEvent(new ApiError(409, 'ชนกัน'), 7)).toMatchObject({
            type: 'saveFailed',
            failure: { kind: 'http', status: 409 },
        })
    })
})

describe('fitsKeepaliveLimit', () => {
    it('counts UTF-8 bytes of the JSON body, so Thai text (3 bytes a letter) runs out sooner', () => {
        // Note: JSON.stringify of a string adds 2 quote characters
        expect(fitsKeepaliveLimit('a'.repeat(KEEPALIVE_BODY_LIMIT_BYTES - 2))).toBe(true)
        expect(fitsKeepaliveLimit('a'.repeat(KEEPALIVE_BODY_LIMIT_BYTES - 1))).toBe(false)
        expect(fitsKeepaliveLimit('ก'.repeat(22_000))).toBe(false)
    })
})

describe('planPageLeaving', () => {
    it('does nothing when nothing changed', () => {
        expect(planPageLeaving(createInitialAutosaveState(serverNote), 2_000)).toBeUndefined()
    })

    it('sends a keepalive save once, and not again for the same text (pagehide after visibilitychange)', () => {
        const plan = planPageLeaving(editedState('hello'), 2_000)
        if (plan === undefined || plan === 'tooLarge') throw new Error('expected a transition')
        expect(plan.commands).toContainEqual(expect.objectContaining({ type: 'sendSaveRequest', keepalive: true }))
        expect(planPageLeaving(plan.state, 2_100)).toBeUndefined()
    })

    it('reports a note that is too big for keepalive instead of sending it', () => {
        expect(planPageLeaving(editedState('x'.repeat(KEEPALIVE_BODY_LIMIT_BYTES)), 2_000)).toBe('tooLarge')
    })
})

describe('isSessionCloseToExpiry', () => {
    it('is true from 2 minutes before the token runs out', () => {
        expect(isSessionCloseToExpiry(1_000_000, 1_000_000 - 120_001)).toBe(false)
        expect(isSessionCloseToExpiry(1_000_000, 1_000_000 - 120_000)).toBe(true)
        expect(isSessionCloseToExpiry(1_000_000, 1_000_001)).toBe(true)
    })
})
