import { useCallback, useState } from 'react'
import { DEFAULT_TITLE, KEYWORD_PARENTS, SEED_NOTES } from '../constants/seed-notes'
import type { PrototypeNote, SaveChoice } from '../types/prototype-note'

let nextId = 100

function findParent(note: PrototypeNote): string | undefined {
    const text = `${note.title} ${note.body}`
    return KEYWORD_PARENTS.find(
        (rule) => !note.rejectedParentIds.includes(rule.parentId)
            && rule.keywords.some((keyword) => text.includes(keyword)),
    )?.parentId
}

export function usePrototypeNotes() {
    const [notes, setNotes] = useState<PrototypeNote[]>(SEED_NOTES)
    const [notice, setNotice] = useState<string | undefined>()

    const patch = useCallback((id: string, changes: Partial<PrototypeNote>) => {
        setNotes((current) => current.map((note) => (note.id === id ? { ...note, ...changes } : note)))
    }, [])

    const startDraft = useCallback((): string => {
        nextId += 1
        const id = `n${nextId}`
        setNotes((current) => [...current, {
            id, title: '', body: '', placement: 'unplaced', rejectedParentIds: [], isDraft: true,
        }])
        return id
    }, [])

    const askAi = useCallback((id: string) => {
        patch(id, { suggestion: { state: 'loading' } })
        window.setTimeout(() => {
            setNotes((current) => current.map((note) => {
                if (note.id !== id) return note
                const parentId = findParent(note)
                return { ...note, suggestion: parentId ? { state: 'ready', parentId } : { state: 'none' } }
            }))
        }, 1200)
    }, [patch])

    const saveDraft = useCallback((id: string, choice: SaveChoice) => {
        patch(id, { isDraft: false, placement: choice === 'root' ? 'root' : 'unplaced' })
        if (choice === 'ai') askAi(id)
    }, [patch, askAi])

    // Note: closing without choosing = Unplaced (ticket 002); empty + default title = deleted
    const closeDraft = useCallback((id: string) => {
        const draft = notes.find((note) => note.id === id)
        if (!draft) return
        if (draft.title === '' && draft.body.trim() === '') {
            setNotes((current) => current.filter((note) => note.id !== id))
            setNotice('Note ว่างถูกลบอัตโนมัติ (ไม่ผ่าน Trash)')
            return
        }
        patch(id, { isDraft: false })
        setNotice(`เก็บ "${draft.title || DEFAULT_TITLE}" ไว้ใน "รอจัดวาง" แล้ว`)
    }, [notes, patch])

    const confirmSuggestion = useCallback((id: string) => {
        const note = notes.find((item) => item.id === id)
        if (!note?.suggestion?.parentId) return
        patch(id, { placement: 'child', parentId: note.suggestion.parentId, suggestion: undefined })
    }, [notes, patch])

    const rejectSuggestion = useCallback((id: string) => {
        const note = notes.find((item) => item.id === id)
        if (!note?.suggestion?.parentId) return
        patch(id, {
            suggestion: undefined,
            rejectedParentIds: [...note.rejectedParentIds, note.suggestion.parentId],
        })
    }, [notes, patch])

    const moveTo = useCallback((id: string, parentId: string | undefined) => {
        patch(id, parentId
            ? { placement: 'child', parentId, suggestion: undefined }
            : { placement: 'root', parentId: undefined, suggestion: undefined })
    }, [patch])

    const addChild = useCallback((parentId: string, title: string): string => {
        nextId += 1
        const id = `n${nextId}`
        setNotes((current) => [...current, {
            id, title, body: '', placement: 'child', parentId, rejectedParentIds: [], isDraft: false,
        }])
        return id
    }, [])

    const notify = useCallback((message: string) => setNotice(message), [])

    const dismissNotice = useCallback(() => setNotice(undefined), [])

    return {
        notes, notice, dismissNotice, startDraft, patch, saveDraft, closeDraft,
        askAi, confirmSuggestion, rejectSuggestion, moveTo, addChild, notify,
    }
}

export type PrototypeNotesApi = ReturnType<typeof usePrototypeNotes>
