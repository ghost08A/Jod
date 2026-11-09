import { useCallback, useEffect, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { getNote } from '../services/note-service'
import type { Note } from '../types/note'
import { createLatestRequestGate } from '../utils/shell/latest-request-gate'

type NoteResult = { noteId: string; note?: Note; error?: ApiError }

export function useNote(noteId: string) {
    const [gate] = useState(createLatestRequestGate)
    const [result, setResult] = useState<NoteResult | undefined>(undefined)
    const [attempt, setAttempt] = useState(0)
    const [shownNoteId, setShownNoteId] = useState(noteId)

    // Note: another note was opened, so whatever was loaded for the old one is dropped before it can be shown
    if (shownNoteId !== noteId) {
        setShownNoteId(noteId)
        setResult(undefined)
    }

    useEffect(() => {
        const token = gate.begin()
        getNote(noteId)
            .then((note) => {
                if (gate.isCurrent(token)) setResult({ noteId, note })
            })
            .catch((failure: unknown) => {
                if (gate.isCurrent(token)) setResult({ noteId, error: failure instanceof ApiError ? failure : toApiError(0, undefined) })
            })
        return gate.cancel
    }, [gate, noteId, attempt])

    const retry = useCallback(() => {
        setResult(undefined)
        setAttempt((previous) => previous + 1)
    }, [])

    const current = result?.noteId === noteId ? result : undefined
    return { note: current?.note, error: current?.error, isLoading: current === undefined, retry }
}
