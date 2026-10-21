import { describe, expect, it } from 'vitest'
import {
    getRetryDelayMs,
    isTransientSaveFailure,
    isTransientStatusCode,
    MAX_TRANSIENT_RETRIES,
    RETRY_DELAYS_MS,
} from './retry-policy'

describe('retry-policy', () => {
    it('returns 2s, 5s, and 10s for retry attempts 1, 2, and 3, then undefined afterwards', () => {
        const firstDelay = getRetryDelayMs(1)
        const secondDelay = getRetryDelayMs(2)
        const thirdDelay = getRetryDelayMs(3)
        const fourthDelay = getRetryDelayMs(4)
        const zeroDelay = getRetryDelayMs(0)

        expect(RETRY_DELAYS_MS).toEqual([2_000, 5_000, 10_000])
        expect(MAX_TRANSIENT_RETRIES).toBe(3)
        expect(firstDelay).toBe(2_000)
        expect(secondDelay).toBe(5_000)
        expect(thirdDelay).toBe(10_000)
        expect(fourthDelay).toBeUndefined()
        expect(zeroDelay).toBeUndefined()
    })

    it('classifies network errors, timeouts, 408, 429, and 5xx as transient failures', () => {
        expect(isTransientSaveFailure({ kind: 'network', message: 'Offline' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'timeout', message: 'Timed out' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'http', status: 0, message: 'No response' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'http', status: 408, message: 'Timeout' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'http', status: 429, message: 'Rate limited' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'http', status: 500, message: 'Internal error' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'http', status: 502, message: 'Bad gateway' })).toBe(true)
        expect(isTransientSaveFailure({ kind: 'http', status: 503, message: 'Unavailable' })).toBe(true)
    })

    it('classifies 400, 401, 403, 404, 409, 413, and 422 as non-transient', () => {
        for (const status of [400, 401, 403, 404, 409, 413, 422]) {
            expect(isTransientStatusCode(status)).toBe(false)
            expect(isTransientSaveFailure({ kind: 'http', status, message: 'Client error' })).toBe(false)
        }
    })
})
