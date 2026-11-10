import { Editor } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import type { SuggestionProps } from '@tiptap/suggestion'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { NoteBlock } from './block-document'
import { createNoteEditorExtensions } from './note-editor-extensions'
import {
    applySlashCommand,
    createSlashMenuRenderer,
    isSlashMenuOpen,
    SLASH_MENU_PLUGIN_KEY,
    type SlashMenuState,
} from './slash-command-extension'
import { SLASH_COMMAND_ITEMS, type SlashCommandItem, type SlashCommandName } from './slash-commands'
import { noteDocumentToTipTap, tipTapToNoteDocument, type TipTapNode } from './tiptap-converter'

// Note: a headless editor (no DOM) gives the real schema and plugins, including the "/" menu plugin. The toggle
// plugin that moves the cursor out of a closed toggle reads the DOM, so it is left out here
const editor = new Editor({
    extensions: createNoteEditorExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
})
afterAll(() => editor.destroy())
const plugins = editor.extensionManager.plugins.filter(
    (plugin) => !('key' in plugin && String(plugin.key).startsWith('detailsSelection')),
)

function stateWith(blocks: NoteBlock[]): EditorState {
    const doc = Node.fromJSON(editor.schema, noteDocumentToTipTap({ schemaVersion: 1, blocks }))
    return EditorState.create({ doc, plugins, selection: TextSelection.atEnd(doc) })
}

function type(state: EditorState, text: string): EditorState {
    return [...text].reduce((current, character) => current.apply(current.tr.insertText(character)), state)
}

function lineText(state: EditorState): string {
    return state.selection.$from.parent.textContent
}

function command(name: SlashCommandName): SlashCommandItem {
    const item = SLASH_COMMAND_ITEMS.find((candidate) => candidate.name === name)
    if (!item) throw new Error(name)
    return item
}

function blocksOf(state: EditorState): NoteBlock[] {
    return tipTapToNoteDocument({ type: 'doc', content: state.doc.toJSON().content as TipTapNode[] }).blocks
}

describe('opening the "/" menu while typing', () => {
    it('opens for a "/" at the start of a line or after a space', () => {
        expect(isSlashMenuOpen(type(stateWith([{ id: 'p', type: 'paragraph', text: '' }]), '/'))).toBe(true)
        expect(isSlashMenuOpen(type(stateWith([{ id: 'p', type: 'paragraph', text: 'ก่อน' }]), ' /h'))).toBe(true)
    })

    it('stays closed inside a code block, even at the start of a line or after a space', () => {
        const code = stateWith([{ id: 'c', type: 'code', text: '' }])

        expect(isSlashMenuOpen(type(code, '/'))).toBe(false)
        expect(isSlashMenuOpen(type(code, 'cd /h'))).toBe(false)
        expect(lineText(type(code, '/h1'))).toBe('/h1')
    })

    it('stays closed for a "/" inside a URL', () => {
        const state = type(stateWith([{ id: 'p', type: 'paragraph', text: '' }]), 'https://a.b/c')

        expect(isSlashMenuOpen(state)).toBe(false)
        expect(lineText(state)).toBe('https://a.b/c')
    })
})

describe('closing the "/" menu with Escape', () => {
    it('keeps the typed text and the caret, and typing on does not reopen it', () => {
        const open = type(stateWith([{ id: 'p', type: 'paragraph', text: 'ก่อน' }]), ' /quo')
        expect(isSlashMenuOpen(open)).toBe(true)

        // Note: this is the transaction the menu plugin dispatches on Escape
        const closed = open.apply(open.tr.setMeta(SLASH_MENU_PLUGIN_KEY, { exit: true }))
        const typedOn = type(closed, 'te')

        expect(isSlashMenuOpen(closed)).toBe(false)
        expect(lineText(closed)).toBe('ก่อน /quo')
        expect(closed.selection.from).toBe(open.selection.from)
        expect(isSlashMenuOpen(typedOn)).toBe(false)
        expect(lineText(typedOn)).toBe('ก่อน /quote')
    })

    it('the menu handles Escape itself without choosing a command', () => {
        const onChange = vi.fn<(menu: SlashMenuState | undefined) => void>()
        const renderer = createSlashMenuRenderer(onChange)()
        const chosen = vi.fn()
        renderer.onStart?.({
            query: 'h',
            items: [command('h1'), command('h2')],
            command: chosen,
            loading: false,
        } as unknown as SuggestionProps<SlashCommandItem, SlashCommandItem>)

        const handled = renderer.onKeyDown?.({ event: { key: 'Escape' } } as never)

        expect(handled).toBe(true)
        expect(chosen).not.toHaveBeenCalled()
    })

    it('Up and Down move the highlight and Enter chooses the highlighted command', () => {
        const onChange = vi.fn<(menu: SlashMenuState | undefined) => void>()
        const renderer = createSlashMenuRenderer(onChange)()
        const chosen = vi.fn()
        renderer.onStart?.({
            query: 'h',
            items: [command('h1'), command('h2'), command('h3')],
            command: chosen,
            loading: false,
        } as unknown as SuggestionProps<SlashCommandItem, SlashCommandItem>)

        renderer.onKeyDown?.({ event: { key: 'ArrowDown' } } as never)
        renderer.onKeyDown?.({ event: { key: 'ArrowDown' } } as never)
        renderer.onKeyDown?.({ event: { key: 'ArrowUp' } } as never)
        renderer.onKeyDown?.({ event: { key: 'Enter' } } as never)

        expect(onChange.mock.lastCall?.[0]?.activeIndex).toBe(1)
        expect(chosen).toHaveBeenCalledWith(command('h2'))
    })
})

describe('applySlashCommand', () => {
    function choose(state: EditorState, name: SlashCommandName): EditorState {
        const pluginState = SLASH_MENU_PLUGIN_KEY.getState(state) as { range: { from: number; to: number } }
        const tr = state.tr
        applySlashCommand(tr, pluginState.range, command(name))
        return state.apply(tr)
    }

    it('replaces "/h1" with a heading in one step and typing goes on at the same place', () => {
        const state = type(stateWith([{ id: 'p', type: 'paragraph', text: '' }]), '/h1')

        const chosen = type(choose(state, 'h1'), 'ชื่อ')

        expect(blocksOf(chosen)).toEqual([{ id: 'p', type: 'heading', level: 1, text: 'ชื่อ' }])
        expect(isSlashMenuOpen(chosen)).toBe(false)
    })

    it.each<[SlashCommandName, Record<string, unknown>]>([
        ['text', { type: 'paragraph' }],
        ['h2', { type: 'heading', level: 2 }],
        ['h3', { type: 'heading', level: 3 }],
        ['bullet', { type: 'bullet', children: [] }],
        ['numbered', { type: 'numbered', children: [] }],
        ['todo', { type: 'checklist', checked: false, children: [] }],
        ['quote', { type: 'quote' }],
        ['code', { type: 'code' }],
        ['toggle', { type: 'toggle', children: [] }],
    ])('"/%s" makes the block the right type and keeps its id', (name, expected) => {
        const state = type(stateWith([{ id: 'p', type: 'paragraph', text: '' }]), `/${name}`)

        const chosen = type(choose(state, name), 'x')

        expect(blocksOf(chosen)).toEqual([{ id: 'p', text: 'x', ...expected }])
    })

    it('turns a list item into a toggle that keeps its text and children', () => {
        const child: NoteBlock = { id: 'c', type: 'paragraph', text: 'ลูก' }
        const doc = Node.fromJSON(
            editor.schema,
            noteDocumentToTipTap({
                schemaVersion: 1,
                blocks: [{ id: 'b', type: 'bullet', text: 'หัว', children: [child] }],
            }),
        )
        const atItemText = EditorState.create({ doc, plugins, selection: TextSelection.create(doc, 3 + 'หัว'.length) })

        const chosen = type(choose(type(atItemText, ' /toggle'), 'toggle'), 'x')

        expect(blocksOf(chosen)).toEqual([{ id: 'b', type: 'toggle', text: 'หัว x', children: [child] }])
    })

    it('inserts a divider and an empty paragraph to type in', () => {
        const state = type(stateWith([{ id: 'p', type: 'paragraph', text: 'ก่อน' }]), ' /divider')

        const chosen = type(choose(state, 'divider'), 'ต่อ')

        expect(blocksOf(chosen).map((block) => block.type)).toEqual(['paragraph', 'divider', 'paragraph'])
        expect(lineText(chosen)).toBe('ต่อ')
    })
})
