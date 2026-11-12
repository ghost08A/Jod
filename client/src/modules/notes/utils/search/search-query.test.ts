import { describe, expect, it } from 'vitest'
import { MAX_SEARCH_LENGTH, toSearchQuery } from './search-query'

describe('toSearchQuery', () => {
    it('trims the text', () => {
        expect(toSearchQuery('  ไทย ')).toBe('ไทย')
    })

    it('does not search blank text', () => {
        expect(toSearchQuery('')).toBeUndefined()
        expect(toSearchQuery(' \n\t ')).toBeUndefined()
    })

    it('searches exactly the longest allowed text, not longer', () => {
        expect(toSearchQuery('a'.repeat(MAX_SEARCH_LENGTH))).toHaveLength(MAX_SEARCH_LENGTH)
        expect(toSearchQuery('a'.repeat(MAX_SEARCH_LENGTH + 1))).toBeUndefined()
    })
})
