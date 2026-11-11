import { Editor } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { EditorState, NodeSelection, TextSelection, type Command } from '@tiptap/pm/state'
import { afterAll, describe, expect, it } from 'vitest'
import type { NoteBlock, NoteDocument } from './block-document'
import { createChildOrExitBlock, createChildParagraph, indentBlock, outdentBlock } from './block-nesting'
import { isNoteDocument } from './note-document-guard'
import { createNoteEditorExtensions } from './note-editor-extensions'
import { noteDocumentToTipTap, tipTapToNoteDocument, type TipTapNode } from './tiptap-converter'

// Note: a headless editor (no DOM) gives the real schema and plugins, including UniqueID. The toggle plugin that
// moves the cursor out of a closed toggle reads the DOM, so it is left out here
const editor = new Editor({
    extensions: createNoteEditorExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
})
afterAll(() => editor.destroy())
const plugins = editor.extensionManager.plugins.filter(
    (plugin) => !('key' in plugin && String(plugin.key).startsWith('detailsSelection')),
)

const failOnNewId = () => {
    throw new Error('a block lost its id')
}

/** An editor state for the blocks with the cursor at the end of the text `cursorText` */
function stateWithCursor(blocks: NoteBlock[], cursorText: string): EditorState {
    const doc = Node.fromJSON(editor.schema, noteDocumentToTipTap({ schemaVersion: 1, blocks }, failOnNewId))
    let cursor: number | undefined
    doc.descendants((node, pos) => {
        if (cursor === undefined && node.isText && node.text === cursorText) cursor = pos + cursorText.length
    })
    if (cursor === undefined) throw new Error(`no text "${cursorText}"`)
    return EditorState.create({
        doc,
        plugins,
        selection: TextSelection.create(doc, cursor),
    })
}

function run(command: Command, state: EditorState): { changed: boolean; state: EditorState } {
    let next = state
    const changed = command(state, (tr) => {
        next = state.apply(tr)
    })
    return { changed, state: next }
}

function toDocument(state: EditorState, generateId: () => string = failOnNewId): NoteDocument {
    return tipTapToNoteDocument({ type: 'doc', content: state.doc.toJSON().content as TipTapNode[] }, generateId)
}

function blockAtCursor(state: EditorState): string {
    return state.selection.$from.parent.textContent
}

const paragraph = (id: string): NoteBlock => ({ id, type: 'paragraph', text: id })
const bullet = (id: string, children: NoteBlock[] = []): NoteBlock => ({ id, type: 'bullet', text: id, children })
const toggle = (id: string, children: NoteBlock[] = []): NoteBlock => ({ id, type: 'toggle', text: id, children })

describe('indentBlock (Tab)', () => {
    it('makes a list item the last child of the list item before it', () => {
        const state = stateWithCursor([bullet('a', [paragraph('a1')]), bullet('b')], 'b')

        const result = run(indentBlock, state)

        expect(result.changed).toBe(true)
        expect(toDocument(result.state).blocks).toEqual([bullet('a', [paragraph('a1'), bullet('b')])])
        expect(blockAtCursor(result.state)).toBe('b')
    })

    it('nests every leaf type under a toggle, a checklist item or a numbered item before it', () => {
        const leaves: NoteBlock[] = [
            paragraph('p'),
            { id: 'h', type: 'heading', level: 2, text: 'h' },
            { id: 'q', type: 'quote', text: 'q' },
            { id: 'c', type: 'code', text: 'c' },
        ]
        for (const leaf of leaves) {
            const containers: NoteBlock[] = [
                toggle('t'),
                { id: 'k', type: 'checklist', text: 'k', checked: true, children: [] },
                { id: 'n', type: 'numbered', text: 'n', children: [] },
            ]
            for (const container of containers) {
                const state = stateWithCursor([container, leaf], leaf.id)

                const result = run(indentBlock, state)

                expect(toDocument(result.state).blocks).toEqual([{ ...container, children: [leaf] }])
                expect(blockAtCursor(result.state)).toBe(leaf.id)
            }
        }
    })

    it('nests a selected divider', () => {
        const blocks: NoteBlock[] = [toggle('t'), { id: 'd', type: 'divider' }]
        const base = stateWithCursor(blocks, 't')
        const dividerPos = base.doc.firstChild?.nodeSize ?? 0
        const state = base.apply(base.tr.setSelection(NodeSelection.create(base.doc, dividerPos)))

        const result = run(indentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([toggle('t', [{ id: 'd', type: 'divider' }])])
    })

    it('moves a list item with its children and joins a list of the same kind inside the target', () => {
        const state = stateWithCursor([toggle('t', [bullet('x')]), bullet('b', [paragraph('b1')])], 'b')

        const result = run(indentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([toggle('t', [bullet('x'), bullet('b', [paragraph('b1')])])])
        const toggleContent = result.state.doc.firstChild?.lastChild
        expect(toggleContent?.childCount).toBe(1)
    })

    it('does nothing after a leaf block or at the first position, but still reports the key as handled-able', () => {
        const afterLeaf = stateWithCursor([paragraph('p'), bullet('b')], 'b')
        const first = stateWithCursor([bullet('a'), paragraph('p')], 'a')
        const firstChild = stateWithCursor([bullet('a', [paragraph('c')])], 'c')

        expect(run(indentBlock, afterLeaf)).toEqual({ changed: false, state: afterLeaf })
        expect(run(indentBlock, first)).toEqual({ changed: false, state: first })
        expect(run(indentBlock, firstChild)).toEqual({ changed: false, state: firstChild })
    })
})

describe('outdentBlock (Shift+Tab)', () => {
    /** The result is a valid Jod document that converts back and forth unchanged */
    function expectValid(state: EditorState) {
        const document = toDocument(state)
        const doc = Node.fromJSON(editor.schema, noteDocumentToTipTap(document, failOnNewId))
        doc.check()
        expect(isNoteDocument(document)).toBe(true)
        expect(toDocument(EditorState.create({ doc }))).toEqual(document)
    }

    it('lifts the last child out to become the block right after its parent', () => {
        const state = stateWithCursor([bullet('a', [paragraph('b'), paragraph('c')]), paragraph('z')], 'c')

        const result = run(outdentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([bullet('a', [paragraph('b')]), paragraph('c'), paragraph('z')])
        expect(blockAtCursor(result.state)).toBe('c')
        expectValid(result.state)
    })

    it('a middle child that is a container takes the later siblings as its last children', () => {
        const state = stateWithCursor(
            [bullet('a', [paragraph('b'), toggle('c', [paragraph('c1')]), paragraph('d'), bullet('e')])],
            'c',
        )

        const result = run(outdentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([
            bullet('a', [paragraph('b')]),
            toggle('c', [paragraph('c1'), paragraph('d'), bullet('e')]),
        ])
        expect(blockAtCursor(result.state)).toBe('c')
        expectValid(result.state)
    })

    it('a middle list item takes the rest of its list as its last children, joined to its own list', () => {
        const state = stateWithCursor([bullet('a', [bullet('b'), bullet('c', [bullet('c1')]), bullet('d')])], 'c')

        const result = run(outdentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([
            bullet('a', [bullet('b')]),
            bullet('c', [bullet('c1'), bullet('d')]),
        ])
        const liftedItem = result.state.doc.firstChild?.lastChild
        expect(liftedItem?.childCount).toBe(2)
        expectValid(result.state)
    })

    it('a middle child that is a leaf takes the later siblings out with it, in the same order', () => {
        const quote: NoteBlock = { id: 'c', type: 'quote', text: 'c' }
        const state = stateWithCursor([toggle('a', [paragraph('b'), quote, bullet('d'), paragraph('e')]), paragraph('z')], 'c')

        const result = run(outdentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([
            toggle('a', [paragraph('b')]),
            quote,
            bullet('d'),
            paragraph('e'),
            paragraph('z'),
        ])
        expect(blockAtCursor(result.state)).toBe('c')
        expectValid(result.state)
    })

    it('a leaf leaving a list item in the middle of a list splits the list around it', () => {
        const state = stateWithCursor([bullet('a', [paragraph('p')]), bullet('b')], 'p')

        const result = run(outdentBlock, state)

        expect(toDocument(result.state).blocks).toEqual([bullet('a'), paragraph('p'), bullet('b')])
        expectValid(result.state)
    })

    it('does nothing at the top level', () => {
        const state = stateWithCursor([bullet('a'), paragraph('p')], 'a')

        expect(run(outdentBlock, state).changed).toBe(false)
    })

    it('Tab then Shift+Tab of the same block gives back the same document', () => {
        const blocks: NoteBlock[] = [bullet('a'), { id: 'q', type: 'quote', text: 'q' }, paragraph('z')]
        const state = stateWithCursor([toggle('t'), ...blocks], 'q')

        const result = run(outdentBlock, run(indentBlock, state).state)

        expect(toDocument(result.state).blocks).toEqual([toggle('t'), ...blocks])
    })

    it('Tab then Shift+Tab of a container with children gives back the same document', () => {
        const blocks: NoteBlock[] = [bullet('x', [paragraph('x1')]), paragraph('z')]
        const state = stateWithCursor([toggle('t'), ...blocks], 'x')

        const result = run(outdentBlock, run(indentBlock, state).state)

        expect(toDocument(result.state).blocks).toEqual([toggle('t'), ...blocks])
        expect(blockAtCursor(result.state)).toBe('x')
    })

    it('Shift+Tab then Tab of the last child gives back the same document', () => {
        const original: NoteBlock[] = [bullet('a', [bullet('b'), bullet('c', [paragraph('c1')])])]
        const state = stateWithCursor(original, 'c')

        const result = run(indentBlock, run(outdentBlock, state).state)

        expect(toDocument(result.state).blocks).toEqual(original)
    })
})

describe('createChildParagraph (Shift+Enter)', () => {
    it('adds an empty child paragraph with a new id under a list item and puts the cursor in it', () => {
        const state = stateWithCursor([bullet('a', [paragraph('old')])], 'a')

        const result = run(createChildParagraph, state)

        const blocks = toDocument(result.state).blocks
        const [item] = blocks
        expect(item?.type === 'bullet' && item.children.map((child) => child.type)).toEqual(['paragraph', 'paragraph'])
        const newChild = item?.type === 'bullet' ? item.children[0] : undefined
        expect(newChild).toMatchObject({ type: 'paragraph', text: '' })
        expect(newChild?.id).toEqual(expect.any(String))
        expect(result.state.selection.$from.parent).toBe(result.state.doc.firstChild?.firstChild?.child(1))
    })

    it('works in a checklist item and nowhere else', () => {
        const task = stateWithCursor([{ id: 'k', type: 'checklist', text: 'k', checked: false, children: [] }], 'k')
        const plain = stateWithCursor([paragraph('p')], 'p')
        const childOfItem = stateWithCursor([bullet('a', [paragraph('c')])], 'c')

        expect(run(createChildParagraph, task).changed).toBe(true)
        expect(run(createChildParagraph, plain).changed).toBe(false)
        expect(run(createChildParagraph, childOfItem).changed).toBe(false)
    })
})

describe('createChildOrExitBlock (Shift+Enter)', () => {
    const checklist = (id: string, children: NoteBlock[] = []): NoteBlock => ({
        id,
        type: 'checklist',
        text: id,
        checked: false,
        children,
    })

    /** Runs Shift+Enter and returns the document with the new paragraph's id replaced by "new" */
    function shiftEnter(state: EditorState) {
        const result = run(createChildOrExitBlock, state)
        const document = toDocument(result.state, () => 'missing')
        const doc = Node.fromJSON(editor.schema, noteDocumentToTipTap(document, failOnNewId))
        doc.check()
        expect(isNoteDocument(document)).toBe(true)
        expect(JSON.stringify(document)).not.toContain('missing')
        const cursorBlockId = result.state.selection.$from.parent.attrs.id as string
        const blocks = JSON.parse(JSON.stringify(document.blocks).replaceAll(cursorBlockId, 'new')) as NoteBlock[]
        return { changed: result.changed, blocks, cursorText: blockAtCursor(result.state) }
    }

    const newParagraph: NoteBlock = { id: 'new', type: 'paragraph', text: '' }

    it('leaves a toggle: a new paragraph after it, the typed text stays inside', () => {
        const result = shiftEnter(stateWithCursor([toggle('t', [paragraph('in')]), paragraph('z')], 'in'))

        expect(result.blocks).toEqual([toggle('t', [paragraph('in')]), newParagraph, paragraph('z')])
        expect(result.cursorText).toBe('')
    })

    it('leaves a checklist item and a bullet item from any leaf child', () => {
        const heading: NoteBlock = { id: 'h', type: 'heading', level: 2, text: 'h' }
        const fromChecklist = shiftEnter(stateWithCursor([checklist('k', [heading]), checklist('k2')], 'h'))
        const fromBullet = shiftEnter(stateWithCursor([bullet('a', [{ id: 'c', type: 'code', text: 'c' }])], 'c'))

        expect(fromChecklist.blocks).toEqual([checklist('k', [heading]), newParagraph, checklist('k2')])
        expect(fromBullet.blocks).toEqual([bullet('a', [{ id: 'c', type: 'code', text: 'c' }]), newParagraph])
    })

    it('leaves only one level when nested two levels deep', () => {
        const result = shiftEnter(stateWithCursor([toggle('t', [checklist('k', [paragraph('deep')])])], 'deep'))

        expect(result.blocks).toEqual([toggle('t', [checklist('k', [paragraph('deep')]), newParagraph])])
    })

    it('keeps the later siblings under the parent', () => {
        const result = shiftEnter(stateWithCursor([toggle('t', [paragraph('b'), paragraph('c')])], 'b'))

        expect(result.blocks).toEqual([toggle('t', [paragraph('b'), paragraph('c')]), newParagraph])
    })

    it('a top-level quote gets a paragraph right after it, the quote text untouched', () => {
        const quote: NoteBlock = { id: 'q', type: 'quote', text: 'q' }
        const result = shiftEnter(stateWithCursor([quote, paragraph('z')], 'q'))

        expect(result.blocks).toEqual([quote, newParagraph, paragraph('z')])
        expect(result.cursorText).toBe('')
    })

    it('a quote inside a toggle gets the paragraph right after the quote, not after the toggle', () => {
        const quote: NoteBlock = { id: 'q', type: 'quote', text: 'q' }
        const result = shiftEnter(stateWithCursor([toggle('t', [quote, paragraph('later')]), paragraph('z')], 'q'))

        expect(result.blocks).toEqual([toggle('t', [quote, newParagraph, paragraph('later')]), paragraph('z')])
    })

    it('a quote inside a list item with later siblings: they stay where they are, after the new paragraph', () => {
        const quote: NoteBlock = { id: 'q', type: 'quote', text: 'q' }
        const state = stateWithCursor([bullet('a', [quote, paragraph('b'), bullet('c')]), bullet('d')], 'q')

        const result = shiftEnter(state)

        expect(result.blocks).toEqual([bullet('a', [quote, newParagraph, paragraph('b'), bullet('c')]), bullet('d')])
    })

    it("still makes an empty child in a list item's own text", () => {
        const result = shiftEnter(stateWithCursor([checklist('k', [paragraph('old')])], 'k'))

        expect(result.blocks).toEqual([checklist('k', [newParagraph, paragraph('old')])])
    })

    it('does nothing (Enter takes over) at the top level and in a toggle summary', () => {
        const topLevel = stateWithCursor([paragraph('p')], 'p')
        const summary = stateWithCursor([toggle('t', [paragraph('in')])], 't')

        expect(run(createChildOrExitBlock, topLevel)).toEqual({ changed: false, state: topLevel })
        expect(run(createChildOrExitBlock, summary)).toEqual({ changed: false, state: summary })
    })
})

describe('nested documents after nesting stay valid Jod documents', () => {
    it('round-trips leaf blocks nested under every container through the converter', () => {
        let state = stateWithCursor(
            [
                bullet('b'),
                paragraph('p'),
                { id: 'n', type: 'numbered', text: 'n', children: [] },
                { id: 'h', type: 'heading', level: 1, text: 'h' },
                { id: 'k', type: 'checklist', text: 'k', checked: false, children: [] },
                { id: 'q', type: 'quote', text: 'q' },
                toggle('t'),
                { id: 'c', type: 'code', text: 'c' },
            ],
            'p',
        )
        for (const text of ['p', 'h', 'q', 'c']) {
            const cursor = stateWithCursor(toDocument(state).blocks, text)
            state = run(indentBlock, cursor).state
        }

        const document = toDocument(state)
        const again = toDocument(stateWithCursor(document.blocks, 'b'))

        expect(isNoteDocument(document)).toBe(true)
        expect(again).toEqual(document)
        expect(document.blocks.map((block) => block.type)).toEqual(['bullet', 'numbered', 'checklist', 'toggle'])
    })
})
