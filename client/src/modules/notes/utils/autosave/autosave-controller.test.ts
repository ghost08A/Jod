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

describe('createAutosaveController: conflict choices', () => {
    function conflictOf(version: number, title: string) {
        return new ApiError(409, 'โน้ตนี้ถูกแก้จากที่อื่นแล้ว', undefined, { payload: { ...initialNote, version, title } })
    }

    function setupConflict() {
        const saveNote = vi.fn<(body: { baseVersion: number; title: string; content: unknown }, keepalive: boolean) => Promise<{ version: number }>>()
        const createNote = vi.fn<() => Promise<{ id: string; version: number }>>()
        const saveOtherNote = vi.fn<(noteId: string, body: { title: string; baseVersion: number; content: unknown }) => Promise<unknown>>()
        const refreshNoteList = vi.fn<() => void>()
        const views: AutosaveView[] = []
        const controller = createAutosaveController({
            initialNote,
            saveNote,
            fetchLatestNote: vi.fn(),
            onViewChange: (view) => views.push(view),
            createNote,
            saveOtherNote,
            refreshNoteList,
        })
        const lastView = () => views.at(-1)
        return { controller, saveNote, createNote, saveOtherNote, refreshNoteList, lastView }
    }

    async function enterConflict(context: ReturnType<typeof setupConflict>) {
        context.saveNote.mockRejectedValueOnce(conflictOf(5, 'Other tab'))
        context.controller.edit({ title: 'Mine', content: documentWith('mine') })
        await vi.advanceTimersByTimeAsync(1_000)
        expect(context.lastView()?.status).toBe('conflict')
    }

    it('shows the server note of the 409 in the view', async () => {
        const context = setupConflict()
        await enterConflict(context)

        expect(context.lastView()?.conflictServerNote).toMatchObject({ version: 5, title: 'Other tab' })
        expect(context.lastView()?.conflictLimitReached).toBe(false)
        expect(context.lastView()?.conflictMyNote?.title).toBe('Mine')
    })

    it('keeps the latest text on screen as this tab version, and ignores typing while in conflict', async () => {
        const context = setupConflict()
        await enterConflict(context)

        context.controller.edit({ title: 'Typed later' })

        expect(context.controller.getCurrentSnapshot().title).toBe('Mine')
    })

    it('keepMine saves again with the version of the server note', async () => {
        const context = setupConflict()
        await enterConflict(context)
        context.saveNote.mockResolvedValue({ version: 6 })

        context.controller.keepMine()
        await vi.advanceTimersByTimeAsync(0)

        expect(context.saveNote).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Mine', baseVersion: 5 }), false)
        expect(context.lastView()?.status).toBe('saved')
    })

    it('keepMine comes back to the conflict with the newest server note, and stops after 3 tries', async () => {
        const context = setupConflict()
        await enterConflict(context)

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            context.saveNote.mockRejectedValueOnce(conflictOf(5 + attempt, `Server ${attempt}`))
            context.controller.keepMine()
            await vi.advanceTimersByTimeAsync(0)
            expect(context.lastView()?.status).toBe('conflict')
            expect(context.lastView()?.conflictServerNote?.title).toBe(`Server ${attempt}`)
        }
        expect(context.lastView()?.conflictLimitReached).toBe(true)

        const callsBefore = context.saveNote.mock.calls.length
        context.controller.keepMine()
        await vi.advanceTimersByTimeAsync(0)
        expect(context.saveNote.mock.calls.length).toBe(callsBefore)
        expect(context.lastView()?.conflictLimitReached).toBe(true)
    })

    it('keepMine keeps showing both versions while the save is in flight, then clears after success', async () => {
        const context = setupConflict()
        await enterConflict(context)
        expect(context.lastView()?.isResolvingConflict).toBe(false)
        let resolveSave: (saved: { version: number }) => void = () => undefined
        context.saveNote.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)))

        context.controller.keepMine()

        expect(context.lastView()?.status).toBe('saving')
        expect(context.lastView()?.isResolvingConflict).toBe(true)
        expect(context.lastView()?.conflictMyNote?.title).toBe('Mine')
        expect(context.lastView()?.conflictServerNote?.title).toBe('Other tab')

        resolveSave({ version: 6 })
        await vi.advanceTimersByTimeAsync(0)
        expect(context.lastView()?.status).toBe('saved')
        expect(context.lastView()?.isResolvingConflict).toBe(false)
        expect(context.lastView()?.conflictMyNote).toBeUndefined()
    })

    it('keepMine goes back to the conflict on a new 409 with the flag cleared and the count kept', async () => {
        const context = setupConflict()
        await enterConflict(context)
        context.saveNote.mockRejectedValueOnce(conflictOf(6, 'Server 1'))

        context.controller.keepMine()
        await vi.advanceTimersByTimeAsync(0)

        expect(context.lastView()?.status).toBe('conflict')
        expect(context.lastView()?.isResolvingConflict).toBe(false)
        expect(context.lastView()?.conflictMyNote?.title).toBe('Mine')
        expect(context.lastView()?.conflictServerNote?.title).toBe('Server 1')
        expect(context.lastView()?.conflictLimitReached).toBe(false)
    })

    it('takeTheirs drops the local text, takes the server note and reloads the fields', async () => {
        const context = setupConflict()
        await enterConflict(context)
        const revisionBefore = context.lastView()?.loadedRevision ?? 0

        context.controller.takeTheirs()

        expect(context.lastView()?.status).toBe('idle')
        expect(context.lastView()?.loadedNote.title).toBe('Other tab')
        expect(context.lastView()?.loadedRevision).toBe(revisionBefore + 1)
        expect(context.lastView()?.conflictServerNote).toBeUndefined()
    })

    it('keepBoth saves the tab version into a new note with new block ids, then takes the server note', async () => {
        const context = setupConflict()
        await enterConflict(context)
        context.createNote.mockResolvedValue({ id: 'new-note', version: 1 })
        context.saveOtherNote.mockResolvedValue({ version: 2 })

        const isDone = await context.controller.keepBoth()

        expect(isDone).toBe(true)
        expect(context.saveOtherNote).toHaveBeenCalledWith(
            'new-note',
            expect.objectContaining({ title: 'Mine (สำเนา)', baseVersion: 1 }),
        )
        const sent = context.saveOtherNote.mock.calls[0]?.[1].content as ReturnType<typeof documentWith>
        expect(sent.blocks[0]?.id).not.toBe('b-1')
        expect(sent.blocks[0]?.text).toBe('mine')
        expect(context.lastView()?.status).toBe('idle')
        expect(context.lastView()?.loadedNote.title).toBe('Other tab')
        expect(context.refreshNoteList).toHaveBeenCalledTimes(1)
    })

    it('keepBoth stays in the conflict with the tab version when the new note cannot be created', async () => {
        const context = setupConflict()
        await enterConflict(context)
        context.createNote.mockRejectedValue(new ApiError(500, 'ล้มเหลว'))

        const isDone = await context.controller.keepBoth()

        expect(isDone).toBe(false)
        expect(context.saveOtherNote).not.toHaveBeenCalled()
        expect(context.lastView()?.status).toBe('conflict')
        expect(context.controller.getCurrentSnapshot().title).toBe('Mine')
        expect(context.refreshNoteList).toHaveBeenCalledTimes(1)
    })

    it('keepBoth stays in the conflict when the text cannot be saved into the new note, and still refreshes the list', async () => {
        const context = setupConflict()
        await enterConflict(context)
        context.createNote.mockResolvedValue({ id: 'new-note', version: 1 })
        context.saveOtherNote.mockRejectedValue(new ApiError(0, 'เครือข่ายมีปัญหา'))

        const isDone = await context.controller.keepBoth()

        expect(isDone).toBe(false)
        expect(context.lastView()?.status).toBe('conflict')
        expect(context.controller.getCurrentSnapshot().content).toEqual(documentWith('mine'))
        expect(context.refreshNoteList).toHaveBeenCalledTimes(1)
    })

    it('keepBoth ignores a second call while the first is still running', async () => {
        const context = setupConflict()
        await enterConflict(context)
        let resolveCreate: (created: { id: string; version: number }) => void = () => undefined
        context.createNote.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)))
        context.saveOtherNote.mockResolvedValue({ version: 2 })

        const first = context.controller.keepBoth()
        const second = context.controller.keepBoth()
        resolveCreate({ id: 'new-note', version: 1 })

        expect(await second).toBe(false)
        expect(await first).toBe(true)
        expect(context.createNote).toHaveBeenCalledTimes(1)
    })

    it('keepBoth does nothing outside a conflict', async () => {
        const context = setupConflict()

        expect(await context.controller.keepBoth()).toBe(false)
        expect(context.createNote).not.toHaveBeenCalled()
    })
})

describe('createAutosaveController base version', () => {
    it('reports the last version the server confirmed, also after the controller is disposed', async () => {
        const { controller, saveNote } = setup()
        saveNote.mockResolvedValue({ version: 2 })
        expect(controller.getBaseVersion()).toBe(1)

        controller.edit({ title: 'New' })
        await vi.advanceTimersByTimeAsync(1_000)
        controller.dispose()

        expect(controller.getBaseVersion()).toBe(2)
        expect(controller.getCurrentSnapshot().title).toBe('New')
    })
})
