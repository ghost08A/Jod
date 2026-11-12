import { describe, expect, it } from 'vitest'
import { cleanSnippet } from './clean-snippet'

describe('cleanSnippet', () => {
    it('turns line breaks into spaces and collapses repeated whitespace', () => {
        expect(cleanSnippet('one\ntwo\r\n\r\n  three\t four')).toBe('one two three four')
    })

    it('trims the ends', () => {
        expect(cleanSnippet('\n hi \n')).toBe('hi')
    })
})
