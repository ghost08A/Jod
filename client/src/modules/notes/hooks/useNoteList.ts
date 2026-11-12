import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { listNotes } from '../services/note-service'
import type { NoteListItem } from '../types/note'
import { createLatestRequestGate } from '../utils/shell/latest-request-gate'

export function useNoteList() {
    const [gate] = useState(createLatestRequestGate)
    const [items, setItems] = useState<NoteListItem[] | undefined>(undefined)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    const hasLoadedRef = useRef(false)

    const load = useCallback(() => {
        const token = gate.begin()
        listNotes()
            .then((loaded) => {
                if (!gate.isCurrent(token)) return
                hasLoadedRef.current = true
                setItems(loaded)
                setError(undefined)
            })
            .catch((failure: unknown) => {
                // Note: a failed background reload (returning to the tab, a refresh) keeps the rows already on screen
                if (gate.isCurrent(token) && !hasLoadedRef.current) {
                    setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
                }
            })
    }, [gate])

    useEffect(() => {
        load()
        return gate.cancel
    }, [gate, load])

    // Note: coming back to the tab loads again and keeps the old rows meanwhile
    useEffect(() => {
        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [load])

    /** Loads again from a blank state, so the skeleton shows again (used by the retry button) */
    const retry = useCallback(() => {
        setError(undefined)
        load()
    }, [load])

    // Note: `refresh` loads again and keeps the old rows on screen meanwhile (used after a note is created)
    return { items, error, isLoading: items === undefined && error === undefined, refresh: load, retry }
}
