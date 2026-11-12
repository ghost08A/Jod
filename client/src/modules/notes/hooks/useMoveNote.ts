import { useRef, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { placeNote } from '../services/note-service'
import type { PlacementRequest } from '../types/note'

/** Sends one placement call at a time. A call made while another runs is ignored; `onMoved` runs after a success */
export function useMoveNote(noteId: string, onMoved: () => void) {
    const [isMoving, setIsMoving] = useState(false)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    // Note: the ref stops a quick second click, because the disabled state only changes after the next render
    const isMovingRef = useRef(false)

    async function move(request: PlacementRequest) {
        if (isMovingRef.current) return
        isMovingRef.current = true
        setError(undefined)
        setIsMoving(true)
        try {
            await placeNote(noteId, request)
            onMoved()
        } catch (failure) {
            setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
        } finally {
            isMovingRef.current = false
            setIsMoving(false)
        }
    }

    return { move, isMoving, error, clearError: () => setError(undefined) }
}
