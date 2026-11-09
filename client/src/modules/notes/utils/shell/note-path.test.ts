import { describe, expect, it } from 'vitest'
import { buildNotePath } from './note-path'

describe('buildNotePath', () => {
    it('puts the note id after /notes/', () => {
        const noteId = '3f2b8c1e-0000-4000-8000-000000000001'

        const path = buildNotePath(noteId)

        expect(path).toBe('/notes/3f2b8c1e-0000-4000-8000-000000000001')
    })

    it('escapes characters that would change the address', () => {
        const noteId = 'a/b?c#d'

        const path = buildNotePath(noteId)

        expect(path).toBe('/notes/a%2Fb%3Fc%23d')
    })
})
