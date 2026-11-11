import { Editor } from '@tiptap/core'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createNoteEditorExtensions } from './note-editor-extensions'
import { whenMenuClosed } from './nesting-keys'

const editor = new Editor({
    extensions: createNoteEditorExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
})
afterAll(() => editor.destroy())

// Note: only the parts of the editor that the key wrapper reads are replaced, so it can be tried without a DOM
function fakeEditor(composing: boolean): Editor {
    return { state: editor.state, view: { composing } } as unknown as Editor
}

describe('whenMenuClosed', () => {
    it('runs the key and takes it when nothing is composing', () => {
        const run = vi.fn()

        const taken = whenMenuClosed(run)({ editor: fakeEditor(false) })

        expect(taken).toBe(true)
        expect(run).toHaveBeenCalledTimes(1)
    })

    it('leaves the key to the IME while text is being composed', () => {
        const run = vi.fn()

        const taken = whenMenuClosed(run)({ editor: fakeEditor(true) })

        expect(taken).toBe(false)
        expect(run).not.toHaveBeenCalled()
    })
})
