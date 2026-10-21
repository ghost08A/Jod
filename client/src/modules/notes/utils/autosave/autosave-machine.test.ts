import { describe, expect, it } from 'vitest'
import {
    createInitialAutosaveState,
    DEBOUNCE_DELAY_MS,
    MAX_WAIT_DELAY_MS,
    transitionAutosave,
} from './autosave-machine'
import type { NoteSnapshot, ServerNoteVersion } from './conflict-equivalence'

function makeSnapshot(text: string, title = 'My Note', context = ''): NoteSnapshot {
    return {
        title,
        context,
        content: {
            schemaVersion: 1,
            blocks: [{ id: 'block-1', type: 'paragraph', text }],
        },
    }
}

function makeServerNote(version: number, text: string, title = 'My Note', context = ''): ServerNoteVersion {
    return {
        version,
        ...makeSnapshot(text, title, context),
    }
}

describe('transitionAutosave', () => {
    it('debounces saves by 1s and resets the 1s timer on each edit before firing', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))

        const afterFirstEdit = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Edit 1'),
            nowMs: 1_000,
        })
        const afterSecondEdit = transitionAutosave(afterFirstEdit.state, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Edit 2'),
            nowMs: 1_600,
        })
        const afterDebounceFires = transitionAutosave(afterSecondEdit.state, {
            type: 'debounceTimerFired',
            nowMs: 2_600,
        })

        expect(afterFirstEdit.state.status).toBe('unsaved')
        expect(afterFirstEdit.commands).toEqual([
            { type: 'setTimer', timer: 'debounce', delayMs: DEBOUNCE_DELAY_MS, dueAtMs: 2_000 },
            { type: 'setTimer', timer: 'maxWait', delayMs: MAX_WAIT_DELAY_MS, dueAtMs: 11_000 },
        ])
        expect(afterSecondEdit.commands).toEqual([
            { type: 'cancelTimer', timer: 'debounce' },
            { type: 'setTimer', timer: 'debounce', delayMs: DEBOUNCE_DELAY_MS, dueAtMs: 2_600 },
        ])
        expect(afterDebounceFires.state.status).toBe('saving')
        expect(afterDebounceFires.commands).toEqual([
            { type: 'cancelTimer', timer: 'debounce' },
            { type: 'cancelTimer', timer: 'maxWait' },
            {
                type: 'sendSaveRequest',
                snapshot: makeSnapshot('Edit 2'),
                baseVersion: 1,
            },
        ])
    })

    it('forces a save at the 10s max-wait ceiling during continuous typing', () => {
        let state = createInitialAutosaveState(makeServerNote(1, 'Initial'))

        for (let step = 0; step < 20; step += 1) {
            const nowMs = 1_000 + step * 500
            const stepResult = transitionAutosave(state, {
                type: 'contentEdited',
                snapshot: makeSnapshot(`Typing ${step}`),
                nowMs,
            })
            state = stepResult.state
            expect(state.status).toBe('unsaved')
        }

        const atCeiling = transitionAutosave(state, {
            type: 'maxWaitTimerFired',
            nowMs: 11_000,
        })

        expect(atCeiling.state.status).toBe('saving')
        expect(atCeiling.commands).toContainEqual({
            type: 'sendSaveRequest',
            snapshot: makeSnapshot('Typing 19'),
            baseVersion: 1,
        })
    })

    it('sends only one request at a time and immediately saves again when edited during an in-flight save without showing "saved"', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))
        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('First draft'),
            nowMs: 1_000,
        })
        const savingFirst = transitionAutosave(edited.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })

        const editedDuringSave = transitionAutosave(savingFirst.state, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Second draft typed while saving'),
            nowMs: 2_300,
        })
        const firstSaveDone = transitionAutosave(editedDuringSave.state, {
            type: 'saveSucceeded',
            newVersion: 2,
            nowMs: 2_500,
        })
        const secondSaveDone = transitionAutosave(firstSaveDone.state, {
            type: 'saveSucceeded',
            newVersion: 3,
            nowMs: 2_900,
        })

        expect(editedDuringSave.state.status).toBe('saving')
        expect(editedDuringSave.commands).toEqual([])
        expect(firstSaveDone.state.status).toBe('saving')
        expect(firstSaveDone.state.baseVersion).toBe(2)
        expect(firstSaveDone.commands).toEqual([
            {
                type: 'sendSaveRequest',
                snapshot: makeSnapshot('Second draft typed while saving'),
                baseVersion: 2,
            },
        ])
        expect(secondSaveDone.state.status).toBe('saved')
        expect(secondSaveDone.state.baseVersion).toBe(3)
    })

    it('retries 3 times at 2s, 5s, and 10s with the latest content on transient failures, then transitions to permanent failed', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))
        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Draft v1'),
            nowMs: 1_000,
        })
        const saving = transitionAutosave(edited.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })

        const failure1 = transitionAutosave(saving.state, {
            type: 'saveFailed',
            failure: { kind: 'network', message: 'Offline' },
            nowMs: 2_500,
        })
        const editedWhileRetrying = transitionAutosave(failure1.state, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Draft v2 updated before retry'),
            nowMs: 3_000,
        })
        const retry1Fired = transitionAutosave(editedWhileRetrying.state, {
            type: 'retryTimerFired',
            nowMs: 4_500,
        })
        const failure2 = transitionAutosave(retry1Fired.state, {
            type: 'saveFailed',
            failure: { kind: 'http', status: 503, message: 'Service unavailable', reference: 'REF-503' },
            nowMs: 5_000,
        })
        const retry2Fired = transitionAutosave(failure2.state, {
            type: 'retryTimerFired',
            nowMs: 10_000,
        })
        const failure3 = transitionAutosave(retry2Fired.state, {
            type: 'saveFailed',
            failure: { kind: 'http', status: 429, message: 'Too many requests' },
            nowMs: 10_500,
        })
        const retry3Fired = transitionAutosave(failure3.state, {
            type: 'retryTimerFired',
            nowMs: 20_500,
        })
        const failure4 = transitionAutosave(retry3Fired.state, {
            type: 'saveFailed',
            failure: { kind: 'timeout', message: 'Request timed out' },
            nowMs: 21_000,
        })

        expect(failure1.state.status).toBe('retrying')
        expect(failure1.commands).toEqual([
            { type: 'setTimer', timer: 'retry', delayMs: 2_000, dueAtMs: 4_500 },
        ])
        expect(retry1Fired.commands).toEqual([
            {
                type: 'sendSaveRequest',
                snapshot: makeSnapshot('Draft v2 updated before retry'),
                baseVersion: 1,
            },
        ])
        expect(failure2.state.status).toBe('retrying')
        expect(failure2.commands).toEqual([
            { type: 'setTimer', timer: 'retry', delayMs: 5_000, dueAtMs: 10_000 },
        ])
        expect(failure3.state.status).toBe('retrying')
        expect(failure3.commands).toEqual([
            { type: 'setTimer', timer: 'retry', delayMs: 10_000, dueAtMs: 20_500 },
        ])
        expect(failure4.state.status).toBe('failed')
        expect(failure4.state.failureReason).toEqual({
            kind: 'timeout',
            message: 'Request timed out',
        })
        expect(failure4.commands).toEqual([])
    })

    it('transitions immediately to permanent failed without retrying on non-408/429 4xx errors', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))
        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Too large note'),
            nowMs: 1_000,
        })
        const saving = transitionAutosave(edited.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })

        const failed400 = transitionAutosave(saving.state, {
            type: 'saveFailed',
            failure: {
                kind: 'http',
                status: 400,
                message: 'เนื้อหาเกินขนาดที่กำหนด',
                reference: 'REF-400',
            },
            nowMs: 2_200,
        })

        expect(failed400.state.status).toBe('failed')
        expect(failed400.state.retryAttempt).toBe(0)
        expect(failed400.state.failureReason).toEqual({
            kind: 'http',
            status: 400,
            message: 'เนื้อหาเกินขนาดที่กำหนด',
            reference: 'REF-400',
        })
        expect(failed400.commands).toEqual([])
    })

    it('does not loop when a 401 still fails after core/http single refresh retry, and transitions to conflict on a real 409', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))
        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Local edit'),
            nowMs: 1_000,
        })
        const saving = transitionAutosave(edited.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })

        const afterUnrecovered401 = transitionAutosave(saving.state, {
            type: 'saveFailed',
            failure: { kind: 'http', status: 401, message: 'เซสชันหมดอายุ' },
            nowMs: 2_300,
        })
        const afterReal409 = transitionAutosave(saving.state, {
            type: 'saveConflicted',
            serverNote: makeServerNote(2, 'Edited in another tab'),
            nowMs: 2_300,
        })

        expect(afterUnrecovered401.state.status).toBe('failed')
        expect(afterUnrecovered401.commands).toEqual([])
        expect(afterReal409.state.status).toBe('conflict')
        expect(afterReal409.state.conflictServerNote).toEqual(
            makeServerNote(2, 'Edited in another tab'),
        )
    })

    it('treats 409 as saved when a retry with an empty title matches the server "Untitled" note structurally', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial', 'Untitled'))
        const editedWithBlankTitle = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: {
                title: '   ',
                context: 'Daily log',
                content: {
                    schemaVersion: 1,
                    blocks: [{ id: 'b-1', type: 'paragraph', text: 'Same text' }],
                },
            },
            nowMs: 1_000,
        })
        const saving = transitionAutosave(editedWithBlankTitle.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })

        const afterEquivalent409 = transitionAutosave(saving.state, {
            type: 'saveConflicted',
            serverNote: {
                version: 2,
                title: 'Untitled',
                context: 'Daily log',
                content: {
                    blocks: [{ text: 'Same text', type: 'paragraph', id: 'b-1' }],
                    schemaVersion: 1,
                },
            },
            nowMs: 2_400,
        })

        expect(afterEquivalent409.state.status).toBe('saved')
        expect(afterEquivalent409.state.baseVersion).toBe(2)
        expect(afterEquivalent409.state.conflictServerNote).toBeUndefined()
    })

    it('marks keepalive save on page leave as result-unknown and refetches the latest note before the next save', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))
        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Before hiding tab'),
            nowMs: 1_000,
        })

        const onLeave = transitionAutosave(edited.state, {
            type: 'pageLeaving',
            nowMs: 1_500,
        })
        const editedAgain = transitionAutosave(onLeave.state, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Typed after returning'),
            nowMs: 5_000,
        })
        const onDebounceAfterLeave = transitionAutosave(editedAgain.state, {
            type: 'debounceTimerFired',
            nowMs: 6_000,
        })
        const afterRefetch = transitionAutosave(onDebounceAfterLeave.state, {
            type: 'refetchSucceeded',
            serverNote: makeServerNote(2, 'Before hiding tab'),
            nowMs: 6_200,
        })

        expect(onLeave.state.requiresRefetchBeforeSave).toBe(true)
        expect(onLeave.commands).toContainEqual({
            type: 'sendSaveRequest',
            snapshot: makeSnapshot('Before hiding tab'),
            baseVersion: 1,
            keepalive: true,
        })
        expect(onDebounceAfterLeave.commands).toContainEqual({
            type: 'refetchLatestNote',
            reason: 'afterKeepalive',
        })
        expect(
            onDebounceAfterLeave.commands.some((command) => command.type === 'sendSaveRequest'),
        ).toBe(false)
        expect(afterRefetch.state.status).toBe('saving')
        expect(afterRefetch.commands).toEqual([
            {
                type: 'sendSaveRequest',
                snapshot: makeSnapshot('Typed after returning'),
                baseVersion: 2,
            },
        ])
    })

    it('asks for confirmation before switching notes only when edits are unsaved, saving, retrying, failed, or conflicted', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Clean'))
        const switchWhileIdle = transitionAutosave(initial, {
            type: 'noteSwitchRequested',
            targetNoteId: 'note-2',
        })

        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Unsaved text'),
            nowMs: 1_000,
        })
        const switchWhileUnsaved = transitionAutosave(edited.state, {
            type: 'noteSwitchRequested',
            targetNoteId: 'note-2',
        })

        const saving = transitionAutosave(edited.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })
        const saved = transitionAutosave(saving.state, {
            type: 'saveSucceeded',
            newVersion: 2,
            nowMs: 2_300,
        })
        const switchWhileSaved = transitionAutosave(saved.state, {
            type: 'noteSwitchRequested',
            targetNoteId: 'note-2',
        })

        expect(switchWhileIdle.commands).toEqual([])
        expect(switchWhileUnsaved.commands).toEqual([
            { type: 'confirmNoteSwitch', targetNoteId: 'note-2' },
        ])
        expect(switchWhileSaved.commands).toEqual([])
    })

    it('silently refetches on tab return only when the note has no unpersisted edits', () => {
        const cleanState = createInitialAutosaveState(makeServerNote(1, 'Clean'))
        const returnWhenClean = transitionAutosave(cleanState, { type: 'tabReturned' })

        const dirtyState = transitionAutosave(cleanState, {
            type: 'contentEdited',
            snapshot: makeSnapshot('Unsaved edit'),
            nowMs: 1_000,
        }).state
        const returnWhenDirty = transitionAutosave(dirtyState, { type: 'tabReturned' })

        expect(returnWhenClean.commands).toEqual([
            { type: 'refetchLatestNote', reason: 'tabReturn' },
        ])
        expect(returnWhenDirty.commands).toEqual([])
    })

    it('allows retrying "use this version" at most 3 times on repeated conflicts and then stops looping', () => {
        const initial = createInitialAutosaveState(makeServerNote(1, 'Initial'))
        const edited = transitionAutosave(initial, {
            type: 'contentEdited',
            snapshot: makeSnapshot('My version'),
            nowMs: 1_000,
        })
        const saving = transitionAutosave(edited.state, {
            type: 'debounceTimerFired',
            nowMs: 2_000,
        })
        let state = transitionAutosave(saving.state, {
            type: 'saveConflicted',
            serverNote: makeServerNote(2, 'Other tab v2'),
            nowMs: 2_200,
        }).state

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            const useMine = transitionAutosave(state, {
                type: 'conflictUseMineRequested',
                nowMs: 3_000 + attempt * 1_000,
            })
            expect(useMine.state.status).toBe('saving')
            expect(useMine.commands).toEqual([
                {
                    type: 'sendSaveRequest',
                    snapshot: makeSnapshot('My version'),
                    baseVersion: attempt + 1,
                },
            ])

            const conflictedAgain = transitionAutosave(useMine.state, {
                type: 'saveConflicted',
                serverNote: makeServerNote(attempt + 2, `Other tab v${attempt + 2}`),
                nowMs: 3_500 + attempt * 1_000,
            })
            state = conflictedAgain.state
            expect(state.status).toBe('conflict')
            expect(state.conflictRetryCount).toBe(attempt)
        }

        expect(state.conflictLimitReached).toBe(true)

        const fourthAttempt = transitionAutosave(state, {
            type: 'conflictUseMineRequested',
            nowMs: 10_000,
        })
        expect(fourthAttempt.state.status).toBe('conflict')
        expect(fourthAttempt.state.conflictLimitReached).toBe(true)
        expect(fourthAttempt.commands).toEqual([])
    })
})
