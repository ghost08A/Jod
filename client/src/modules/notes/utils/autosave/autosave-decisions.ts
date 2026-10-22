export type AutosaveStatus =
    | 'idle'
    | 'unsaved'
    | 'saving'
    | 'retrying'
    | 'saved'
    | 'failed'
    | 'conflict'

export const MAX_CONFLICT_RESOLUTION_RETRIES = 3

/**
 * Asks the user to confirm before switching notes whenever the current note has
 * unsaved edits, an in-flight save, a pending retry, a permanent failure, or an unresolved conflict.
 */
export function shouldConfirmBeforeSwitchingNote(status: AutosaveStatus): boolean {
    return (
        status === 'unsaved' ||
        status === 'saving' ||
        status === 'retrying' ||
        status === 'failed' ||
        status === 'conflict'
    )
}

/**
 * Silently refetches the latest note when returning to a tab only if the tab has no unpersisted edits.
 */
export function shouldRefetchOnTabReturn(status: AutosaveStatus): boolean {
    return status === 'idle' || status === 'saved'
}

/**
 * Stops retrying "use this version" in the conflict screen once it has collided 3 times in a row.
 */
export function hasReachedConflictRetryLimit(conflictRetryCount: number): boolean {
    return conflictRetryCount >= MAX_CONFLICT_RESOLUTION_RETRIES
}
