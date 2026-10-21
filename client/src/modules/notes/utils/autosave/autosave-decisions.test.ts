import { describe, expect, it } from 'vitest'
import {
    hasReachedConflictRetryLimit,
    MAX_CONFLICT_RESOLUTION_RETRIES,
    shouldConfirmBeforeSwitchingNote,
    shouldRefetchOnTabReturn,
} from './autosave-decisions'

describe('shouldConfirmBeforeSwitchingNote', () => {
    it('returns true when the note is unsaved, saving, retrying, failed, or in conflict', () => {
        expect(shouldConfirmBeforeSwitchingNote('unsaved')).toBe(true)
        expect(shouldConfirmBeforeSwitchingNote('saving')).toBe(true)
        expect(shouldConfirmBeforeSwitchingNote('retrying')).toBe(true)
        expect(shouldConfirmBeforeSwitchingNote('failed')).toBe(true)
        expect(shouldConfirmBeforeSwitchingNote('conflict')).toBe(true)
    })

    it('returns false when there are no pending edits (idle or saved)', () => {
        expect(shouldConfirmBeforeSwitchingNote('idle')).toBe(false)
        expect(shouldConfirmBeforeSwitchingNote('saved')).toBe(false)
    })
})

describe('shouldRefetchOnTabReturn', () => {
    it('returns true only when the tab has no local edits (idle or saved)', () => {
        expect(shouldRefetchOnTabReturn('idle')).toBe(true)
        expect(shouldRefetchOnTabReturn('saved')).toBe(true)
    })

    it('returns false when the tab has unsaved changes, is saving, retrying, failed, or in conflict', () => {
        expect(shouldRefetchOnTabReturn('unsaved')).toBe(false)
        expect(shouldRefetchOnTabReturn('saving')).toBe(false)
        expect(shouldRefetchOnTabReturn('retrying')).toBe(false)
        expect(shouldRefetchOnTabReturn('failed')).toBe(false)
        expect(shouldRefetchOnTabReturn('conflict')).toBe(false)
    })
})

describe('hasReachedConflictRetryLimit', () => {
    it('allows up to 3 conflict resolution attempts and stops once the count reaches 3', () => {
        expect(MAX_CONFLICT_RESOLUTION_RETRIES).toBe(3)
        expect(hasReachedConflictRetryLimit(0)).toBe(false)
        expect(hasReachedConflictRetryLimit(1)).toBe(false)
        expect(hasReachedConflictRetryLimit(2)).toBe(false)
        expect(hasReachedConflictRetryLimit(3)).toBe(true)
        expect(hasReachedConflictRetryLimit(4)).toBe(true)
    })
})
