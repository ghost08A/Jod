import { describe, expect, it } from 'vitest'
import { formatDateTimeMinutes } from './format-date-time'

describe('formatDateTimeMinutes', () => {
    it('formats local time as YYYY-MM-DD HH:mm with zero padding', () => {
        expect(formatDateTimeMinutes(new Date(2026, 0, 5, 7, 3, 59).toISOString())).toBe('2026-01-05 07:03')
    })
    it('returns the text unchanged when it is not a date', () => {
        expect(formatDateTimeMinutes('not a date')).toBe('not a date')
    })
})
