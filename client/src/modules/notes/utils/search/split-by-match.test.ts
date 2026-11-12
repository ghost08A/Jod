import { describe, expect, it } from 'vitest'
import { splitByMatch } from './split-by-match'

describe('splitByMatch', () => {
    it('marks a match regardless of case and keeps the original letters', () => {
        expect(splitByMatch('Hello World', 'world')).toEqual([
            { text: 'Hello ', isMatch: false },
            { text: 'World', isMatch: true },
        ])
    })

    it('marks every match', () => {
        expect(splitByMatch('abab', 'ab')).toEqual([
            { text: 'ab', isMatch: true },
            { text: 'ab', isMatch: true },
        ])
    })

    it('returns the whole text when nothing matches or the query is empty', () => {
        expect(splitByMatch('abc', 'x')).toEqual([{ text: 'abc', isMatch: false }])
        expect(splitByMatch('abc', '')).toEqual([{ text: 'abc', isMatch: false }])
        expect(splitByMatch('', 'x')).toEqual([{ text: '', isMatch: false }])
    })

    it('does not count overlapping matches twice', () => {
        expect(splitByMatch('aaa', 'aa')).toEqual([
            { text: 'aa', isMatch: true },
            { text: 'a', isMatch: false },
        ])
    })

    it('treats regex characters as plain text', () => {
        expect(splitByMatch('a.b (x) 100% a+b', '.')).toEqual([
            { text: 'a', isMatch: false },
            { text: '.', isMatch: true },
            { text: 'b (x) 100% a+b', isMatch: false },
        ])
        expect(splitByMatch('f(x)*', '(x)*')).toEqual([
            { text: 'f', isMatch: false },
            { text: '(x)*', isMatch: true },
        ])
        expect(splitByMatch('a\\b', '\\')).toHaveLength(3)
    })

    it('matches Thai text as a substring', () => {
        expect(splitByMatch('ประเทศไทย', 'ไทย')).toEqual([
            { text: 'ประเทศ', isMatch: false },
            { text: 'ไทย', isMatch: true },
        ])
    })

    it('never cuts a surrogate pair', () => {
        const parts = splitByMatch('a😀b😀', '😀')
        expect(parts.map((part) => part.text)).toEqual(['a', '😀', 'b', '😀'])
        expect(splitByMatch('😀', '\ud83d')).toEqual([{ text: '😀', isMatch: false }])
    })
})
