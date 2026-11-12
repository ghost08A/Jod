import { useRef, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { deleteNote } from '../services/note-service'
import type { DeleteScope } from '../types/note'

/** Sends one delete at a time. `deletingScope` is the choice that was pressed; a call made while one runs is ignored */
export function useDeleteNote(noteId: string, onDeleted: () => void) {
    const [deletingScope, setDeletingScope] = useState<DeleteScope | undefined>(undefined)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    // Note: the ref stops a quick second click, because the disabled state only changes after the next render
    const isDeletingRef = useRef(false)

    async function remove(scope: DeleteScope) {
        if (isDeletingRef.current) return
        isDeletingRef.current = true
        setError(undefined)
        setDeletingScope(scope)
        try {
            await deleteNote(noteId, scope)
            onDeleted()
        } catch (failure) {
            setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
        } finally {
            isDeletingRef.current = false
            setDeletingScope(undefined)
        }
    }

    return { remove, deletingScope, isDeleting: deletingScope !== undefined, error }
}
