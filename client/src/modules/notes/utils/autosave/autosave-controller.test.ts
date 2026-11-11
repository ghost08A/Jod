import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, toConnectionError } from '../../../../core/http/api-error'
import { createAutosaveController, type AutosaveView } from './autosave-controller'
import { KEEPALIVE_BODY_LIMIT_BYTES } from './save-request'

function documentWith(text: string) {
    return { schemaVersion: 1, blocks: [{ id: 'b-1', type: 'paragraph', text }] }
}

const initialNote = { version: 1, title: 'Note', context: '', content: documentWith('start') }

function setup() {
    const saveNote = vi.fn<(body: { baseVersion: number; content: unknown }, keepalive: boolean) => Promise<{ version: number }>>()
    const fetchLatestNote = vi.fn<() => Promise<typeof initialNote>>()
    const keepSessionFresh = vi.fn<() => void>()
    const views: AutosaveView[] = []
    const controller = createAutosaveController({
        initialNote,
        saveNote,
        fetchLatestNote,
        onViewChange: (view) => views.push(view),
        keepSessionFresh,
    })
    const lastView = () => views.at(-1)
    return { controller, saveNote, fetchLatestNote, keepSessionFresh, lastView }
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('createAutosaveController', () => {
    it('saves the cleaned text 1s after typing stops and shows saved only after the server accepts it', async () => {
        const { controller, saveNote, lastView } = setup()
        saveNote.mockResolvedValue({ version: 2 })

        controller.edit({ content: documentWith('hi\u0000') })
        await vi.advanceTimersByTimeAsync(999)
        expect(saveNote).not.toHaveBeenCalled()
        expect(lastView()?.status).toBe('unsaved')

        await vi.advanceTimersByTimeAsync(1)
        expect(saveNote).toHaveBeenCalledWith(
            { title: 'Note', context: '', content: documentWith('hi'), baseVersion: 1 },
            false,
        )
        expect(lastView()?.status).toBe('saved')
    })

    it('stops at failed without retrying on a 400, keeping the server message', async () => {
        const { controller, saveNote, lastView } = setup()
        saveNote.mockRejectedValue(new ApiError(400, 'เนื้อหาของโน้ตไม่ถูกต้อง', 'REF-9'))

        controller.edit({ title: 'New' })
        await vi.advanceTimersByTimeAsync(60_000)

        expect(saveNote).toHaveBeenCalledTimes(1)
        expect(lastView()).toMatchObject({
            status: 'failed',
            failureReason: { kind: 'http', status: 400, message: 'เนื้อหาของโน้ตไม่ถูกต้อง', reference: 'REF-9' },
        })
    })

    it('retries an offline save after 2s and the manual retry sends it again', async () => {
        const { controller, saveNote, lastView } = setup()
        saveNote.mockRejectedValue(toConnectionError())

        controller.edit({ title: 'Offline' })
        await vi.advanceTimersByTimeAsync(1_000)
        expect(lastView()?.status).toBe('retrying')

        await vi.advanceTimersByTimeAsync(2_000)
        expect(saveNote).toHaveBeenCalledTimes(2)

        saveNote.mockResolvedValue({ version: 2 })
        controller.retry()
        await vi.advanceTimersByTimeAsync(0)
        expect(saveNote).toHaveBeenCalledTimes(3)
        expect(lastView()?.status).toBe('saved')
    })

    it('moves to conflict on a 409 that carries a different server note', async () => {
        const { controller, saveNote, lastView } = setup()
        saveNote.mockRejectedValue(
            new ApiError(409, 'โน้ตนี้ถูกแก้จากที่อื่นแล้ว', undefined, {
                payload: { ...initialNote, version: 5, title: 'Other tab' },
            }),
        )

        controller.edit({ title: 'Mine' })
        await vi.advanceTimersByTimeAsync(1_000)

        expect(lastView()?.status).toBe('conflict')
    })

    it('sends one keepalive on leaving, then checks the latest note on return before showing saved', async () => {
        const { controller, saveNote, fetchLatestNote, lastView } = setup()
        saveNote.mockResolvedValue({ version: 2 })
        fetchLatestNote.mockResolvedValue({ ...initialNote, version: 2, content: documentWith('typed') })

        controller.edit({ content: documentWith('typed') })
        controller.leavePage()
        controller.leavePage()
        await vi.advanceTimersByTimeAsync(5_000)

        expect(saveNote).toHaveBeenCalledTimes(1)
        expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ baseVersion: 1 }), true)
        expect(lastView()?.status).toBe('unsaved')

        controller.returnToPage()
        await vi.advanceTimersByTimeAsync(0)
        expect(fetchLatestNote).toHaveBeenCalledTimes(1)
        expect(lastView()?.status).toBe('saved')
    })

    it('does not send a note too big for keepalive on leaving, flags it, and still saves it normally', async () => {
        const { controller, saveNote, lastView } = setup()
        saveNote.mockResolvedValue({ version: 2 })

        controller.edit({ content: documentWith('x'.repeat(KEEPALIVE_BODY_LIMIT_BYTES)) })
        controller.leavePage()
        expect(saveNote).not.toHaveBeenCalled()
        expect(lastView()).toMatchObject({ status: 'unsaved', isTooLargeForKeepalive: true })

        await vi.advanceTimersByTimeAsync(1_000)
        expect(saveNote).toHaveBeenCalledWith(expect.anything(), false)
        expect(lastView()).toMatchObject({ status: 'saved', isTooLargeForKeepalive: false })
    })

    it('shows a failed check of the latest note and asks again on retry', async () => {
        const { controller, saveNote, fetchLatestNote, lastView } = setup()
        saveNote.mockResolvedValue({ version: 2 })
        fetchLatestNote.mockRejectedValueOnce(toConnectionError())

        controller.edit({ title: 'Away' })
        controller.leavePage()
        controller.returnToPage()
        await vi.advanceTimersByTimeAsync(0)
        expect(lastView()).toMatchObject({ status: 'unsaved', hasRefetchFailed: true })

        fetchLatestNote.mockResolvedValue({ ...initialNote, version: 1 })
        controller.retry()
        await vi.advanceTimersByTimeAsync(0)
        expect(fetchLatestNote).toHaveBeenCalledTimes(2)
        expect(saveNote).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Away', baseVersion: 1 }), false)
        expect(lastView()).toMatchObject({ status: 'saved', hasRefetchFailed: false })
    })

    it('ignores a save that answers after dispose: no new view, no new timer, no new request', async () => {
        const { controller, saveNote, lastView } = setup()
        let answerSave: (value: { version: number }) => void = () => undefined
        saveNote.mockReturnValue(new Promise((resolve) => (answerSave = resolve)))

        controller.edit({ title: 'In flight' })
        await vi.advanceTimersByTimeAsync(1_000)
        expect(lastView()?.status).toBe('saving')
        // Note: an edit during the save would make a live controller send again right after the answer
        controller.edit({ title: 'Typed during save' })
        const viewBeforeDispose = lastView()

        controller.dispose()
        answerSave({ version: 2 })
        await vi.advanceTimersByTimeAsync(0)

        expect(lastView()).toBe(viewBeforeDispose)
        expect(vi.getTimerCount()).toBe(0)
        expect(saveNote).toHaveBeenCalledTimes(1)
    })

    it('stops its timers after dispose', async () => {
        const { controller, saveNote } = setup()
        controller.edit({ title: 'Gone' })
        controller.dispose()
        await vi.advanceTimersByTimeAsync(20_000)
        expect(saveNote).not.toHaveBeenCalled()
    })

    it('silently loads a newer note on return to an untouched tab and saves the next edit on top of it', async () => {
        const { controller, saveNote, fetchLatestNote, lastView } = setup()
        const newer = { version: 4, title: 'From other tab', context: 'ctx', content: documentWith('newer') }
        fetchLatestNote.mockResolvedValue(newer)
        saveNote.mockResolvedValue({ version: 5 })

        controller.returnToPage()
        await vi.advanceTimersByTimeAsync(0)
        expect(lastView()).toMatchObject({ status: 'idle', loadedRevision: 1, loadedNote: { title: 'From other tab', context: 'ctx' } })

        controller.edit({ title: 'Mine' })
        await vi.advanceTimersByTimeAsync(1_000)
        expect(saveNote).toHaveBeenCalledWith(
            { title: 'Mine', context: 'ctx', content: documentWith('newer'), baseVersion: 4 },
            false,
        )
        expect(lastView()).toMatchObject({ status: 'saved', loadedRevision: 1 })
    })

    it('does not reload the note on return while there are unsaved edits, and a failed silent check shows nothing', async () => {
        const { controller, fetchLatestNote, lastView } = setup()
        controller.edit({ title: 'Typing' })
        controller.returnToPage()
        await vi.advanceTimersByTimeAsync(0)
        expect(fetchLatestNote).not.toHaveBeenCalled()
        expect(lastView()?.loadedRevision).toBe(0)
        controller.dispose()

        const untouched = setup()
        untouched.fetchLatestNote.mockRejectedValue(toConnectionError())
        untouched.controller.returnToPage()
        await vi.advanceTimersByTimeAsync(0)
        expect(untouched.fetchLatestNote).toHaveBeenCalledTimes(1)
        expect(untouched.lastView()).toMatchObject({ status: 'idle', hasRefetchFailed: false, loadedRevision: 0 })
    })

    it('asks before switching notes only while text could be lost', async () => {
        const { controller, saveNote } = setup()
        saveNote.mockResolvedValue({ version: 2 })
        expect(controller.requestNoteSwitch('/notes/other')).toBe(false)

        controller.edit({ title: 'Unsaved' })
        expect(controller.requestNoteSwitch('/notes/other')).toBe(true)

        await vi.advanceTimersByTimeAsync(1_000)
        expect(controller.getStatus()).toBe('saved')
        expect(controller.requestNoteSwitch('/notes/other')).toBe(false)
    })

    it('asks to keep the session fresh only while text is unsaved', async () => {
        const { controller, saveNote, keepSessionFresh } = setup()
        saveNote.mockResolvedValue({ version: 2 })

        controller.edit({ title: 'Unsaved' })
        expect(keepSessionFresh).toHaveBeenCalledTimes(1)

        // Note: one more call for 'saving' (still unsaved), none for the final 'saved'
        await vi.advanceTimersByTimeAsync(1_000)
        expect(controller.getStatus()).toBe('saved')
        expect(keepSessionFresh).toHaveBeenCalledTimes(2)
    })
})
