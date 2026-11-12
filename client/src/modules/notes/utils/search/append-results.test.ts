import { describe, expect, it } from 'vitest'
import type { NoteSearchResult } from '../../types/note'
import { appendResults } from './append-results'

function result(id: string): NoteSearchResult {
    return { id, title: id, updatedAt: '2026-01-01T00:00:00Z', path: [], snippet: '' }
}

describe('appendResults', () => {
    it('puts the next page after the shown results', () => {
        expect(appendResults([result('a')], [result('b'), result('c')]).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })

    it('drops a note that is already shown', () => {
        expect(appendResults([result('a'), result('b')], [result('b'), result('c')]).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    })

    it('does not change the shown results', () => {
        const shown = [result('a')]
        appendResults(shown, [result('b')])
        expect(shown).toHaveLength(1)
    })
})
