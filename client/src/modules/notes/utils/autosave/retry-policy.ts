export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const

export const MAX_TRANSIENT_RETRIES = RETRY_DELAYS_MS.length

export type SaveFailureCause =
    | {
          kind: 'network' | 'timeout'
          message: string
          reference?: string
      }
    | {
          kind: 'http'
          status: number
          message: string
          reference?: string
      }

/**
 * Only connection failure (status 0), 408 Request Timeout, 429 Too Many Requests,
 * and 5xx server errors are retried automatically. Other 4xx responses fail permanently.
 */
export function isTransientStatusCode(status: number): boolean {
    if (status === 0 || status === 408 || status === 429) return true
    return status >= 500 && status <= 599
}

export function isTransientSaveFailure(failure: SaveFailureCause): boolean {
    if (failure.kind === 'http') return isTransientStatusCode(failure.status)
    return true
}

/**
 * Returns the backoff delay in milliseconds for a 1-based retry attempt (1 -> 2s, 2 -> 5s, 3 -> 10s),
 * or undefined once all 3 automatic retries have been used.
 */
export function getRetryDelayMs(retryAttempt: number): number | undefined {
    if (!Number.isInteger(retryAttempt) || retryAttempt < 1 || retryAttempt > MAX_TRANSIENT_RETRIES) {
        return undefined
    }
    return RETRY_DELAYS_MS[retryAttempt - 1]
}
