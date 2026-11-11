import { describe, expect, it } from 'vitest'
import { noteToPlainText } from './note-plain-text'

describe('noteToPlainText', () => {
    it('writes title, context and one line per block with nesting, list numbers and checkboxes', () => {
        const text = noteToPlainText({
            title: 'Trip',
            context: 'June',
            content: {
                schemaVersion: 1,
                blocks: [
                    { id: '1', type: 'heading', level: 1, text: 'Plan' },
                    { id: '2', type: 'numbered', text: 'Pack', children: [{ id: '3', type: 'checklist', text: 'Socks', checked: true, children: [] }] },
                    { id: '4', type: 'numbered', text: 'Go', children: [] },
                    { id: '5', type: 'divider' },
                    { id: '6', type: 'numbered', text: 'Again', children: [] },
                    { id: '7', type: 'bullet', text: 'Note', children: [{ id: '8', type: 'checklist', text: 'Open', checked: false, children: [] }] },
                    { id: '9', type: 'quote', text: 'Said' },
                ],
            },
        })

        expect(text).toBe(
            ['Trip', 'June', '', 'Plan', '1. Pack', '  [x] Socks', '2. Go', '---', '1. Again', '- Note', '  [ ] Open', '> Said'].join('\n'),
        )
    })

    it('leaves out an empty context and copes with content it cannot read', () => {
        expect(noteToPlainText({ title: 'Only', context: '', content: 'broken' })).toBe('Only\n')
    })
})
