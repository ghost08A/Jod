import { useRef, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'

/**
 * Runs one Trash action (restore or delete for good) at a time. `onDone` runs after it worked.
 * `onGone` runs when the server says 404 (the note is no longer in Trash), so the caller can refresh; the error stays shown
 */
export function useTrashMutation(action: () => Promise<unknown>, onDone: () => void, onGone: () => void) {
    const [isRunning, setIsRunning] = useState(false)
    const [error, setError] = useState<ApiError | undefined>(undefined)
    // Note: the ref stops a quick second click, because the disabled state only changes after the next render
    const isRunningRef = useRef(false)

    async function run() {
        if (isRunningRef.current) return
        isRunningRef.current = true
        setError(undefined)
        setIsRunning(true)
        try {
            await action()
            onDone()
        } catch (failure) {
            const apiError = failure instanceof ApiError ? failure : toApiError(0, undefined)
            setError(apiError)
            if (apiError.status === 404) onGone()
        } finally {
            isRunningRef.current = false
            setIsRunning(false)
        }
    }

    return { run, isRunning, error }
}
