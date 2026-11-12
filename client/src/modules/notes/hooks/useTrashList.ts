import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { listTrash } from '../services/note-service'
import type { TrashNoteItem } from '../types/note'
import { createLatestRequestGate } from '../utils/shell/latest-request-gate'

/** The deleted notes. Loads when the Trash page opens and again when the user comes back to the tab */
export function useTrashList() {
    const [gate] = useState(createLatestRequestGate)
    const [items, setItems] = useState<TrashNoteItem[] | undefined>(undefined)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    const hasLoadedRef = useRef(false)

    const load = useCallback(() => {
        const token = gate.begin()
        listTrash()
            .then((loaded) => {
                if (!gate.isCurrent(token)) return
                hasLoadedRef.current = true
                setItems(loaded)
                setError(undefined)
            })
            .catch((failure: unknown) => {
                // Note: a failed background reload keeps the rows already on screen
                if (gate.isCurrent(token) && !hasLoadedRef.current) {
                    setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
                }
            })
    }, [gate])

    useEffect(() => {
        load()
        return gate.cancel
    }, [gate, load])

    useEffect(() => {
        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [load])

    const retry = useCallback(() => {
        setError(undefined)
        load()
    }, [load])

    return { items, error, isLoading: items === undefined && error === undefined, retry }
}
