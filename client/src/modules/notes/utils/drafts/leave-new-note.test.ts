import { describe, expect, it, vi } from 'vitest'
import { leaveNewNote } from './leave-new-note'
import { isNewNoteDraft, registerNewNoteDraft } from './new-note-drafts'

const untouched = { title: 'Untitled', context: '', content: { schemaVersion: 1, blocks: [{ id: 'b', type: 'paragraph', text: '' }] } }
const written = { ...untouched, title: 'Plan' }

describe('leaveNewNote', () => {
    it('does nothing for a note that was not made by the New note button', async () => {
        const discard = vi.fn()
        await leaveNewNote('not-a-draft', () => ({ snapshot: untouched, baseVersion: 1 }), discard, vi.fn())
        expect(discard).not.toHaveBeenCalled()
    })

    it('asks the server with the last saved version when the note is still untouched, then refreshes and forgets', async () => {
        registerNewNoteDraft('untouched-1')
        const discard = vi.fn().mockResolvedValue({ discarded: true })
        const onDiscarded = vi.fn()
        await leaveNewNote('untouched-1', () => ({ snapshot: untouched, baseVersion: 3 }), discard, onDiscarded)
        expect(discard).toHaveBeenCalledWith('untouched-1', 3)
        expect(onDiscarded).toHaveBeenCalledTimes(1)
        expect(isNewNoteDraft('untouched-1')).toBe(false)
    })

    it('forgets the note without refreshing when the server kept it', async () => {
        registerNewNoteDraft('kept-1')
        const onDiscarded = vi.fn()
        await leaveNewNote('kept-1', () => ({ snapshot: untouched, baseVersion: 1 }), vi.fn().mockResolvedValue({ discarded: false }), onDiscarded)
        expect(onDiscarded).not.toHaveBeenCalled()
        expect(isNewNoteDraft('kept-1')).toBe(false)
    })

    it('forgets a note that was written in without asking the server, so erasing it later never removes it', async () => {
        registerNewNoteDraft('written-1')
        const discard = vi.fn()
        await leaveNewNote('written-1', () => ({ snapshot: written, baseVersion: 2 }), discard, vi.fn())
        expect(discard).not.toHaveBeenCalled()
        expect(isNewNoteDraft('written-1')).toBe(false)
    })

    it('forgets the note and stays silent when the call fails', async () => {
        registerNewNoteDraft('failed-1')
        const onDiscarded = vi.fn()
        await leaveNewNote('failed-1', () => ({ snapshot: untouched, baseVersion: 1 }), vi.fn().mockRejectedValue(new Error('offline')), onDiscarded)
        expect(onDiscarded).not.toHaveBeenCalled()
        expect(isNewNoteDraft('failed-1')).toBe(false)
    })

    it('forgets the note when its state can no longer be read', async () => {
        registerNewNoteDraft('gone-1')
        const discard = vi.fn()
        await leaveNewNote('gone-1', () => undefined, discard, vi.fn())
        expect(discard).not.toHaveBeenCalled()
        expect(isNewNoteDraft('gone-1')).toBe(false)
    })
})
