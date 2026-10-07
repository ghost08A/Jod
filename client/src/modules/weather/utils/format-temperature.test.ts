import { describe, expect, it } from 'vitest'
import { formatTemperature } from './format-temperature'

describe('formatTemperature', () => {
    it('formats with one decimal and unit', () => {
        expect(formatTemperature(21)).toBe('21.0 °C')
    })
})
