import { describe, expect, it } from 'vitest'
import { buildSearchPath, toSearchOptions } from './search-request'

describe('toSearchOptions', () => {
    it('sends nothing extra for all notes without a filter', () => {
        expect(toSearchOptions('all', undefined)).toEqual({})
    })

    it('sends the parent for all notes with a filter', () => {
        expect(toSearchOptions('all', 'p1')).toEqual({ parentId: 'p1' })
    })

    it('drops the parent in the Trash scope', () => {
        expect(toSearchOptions('trash', 'p1')).toEqual({ inTrash: true })
    })
})

describe('buildSearchPath', () => {
    it('builds the plain request', () => {
        expect(buildSearchPath('a b', 0)).toBe('/api/notes/search?q=a%20b&skip=0')
    })

    it('adds the parent', () => {
        expect(buildSearchPath('x', 50, { parentId: 'p1' })).toBe('/api/notes/search?q=x&skip=50&parentId=p1')
    })

    it('adds inTrash only when true', () => {
        expect(buildSearchPath('x', 0, { inTrash: true })).toBe('/api/notes/search?q=x&skip=0&inTrash=true')
        expect(buildSearchPath('x', 0, { inTrash: false })).toBe('/api/notes/search?q=x&skip=0')
    })

    it('refuses a parent together with Trash', () => {
        expect(() => buildSearchPath('x', 0, { parentId: 'p1', inTrash: true })).toThrow()
    })
})
