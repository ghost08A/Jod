import { Node, type NodeViewRenderer } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

type NoteReferenceOptions = {
    /** Draws the card; without it the node is an empty block (as in tests) */
    nodeView: NodeViewRenderer | undefined
}

/**
 * A card that points at another note: one block, no text, no children. The block id comes from UniqueID.
 * It is one unit for the cursor: selected as a whole, deleted with Backspace/Delete, dragged like other blocks.
 */
export const NoteReference = Node.create<NoteReferenceOptions>({
    name: 'noteReference',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
        return { nodeView: undefined }
    },

    addAttributes() {
        return {
            noteId: {
                default: null,
                rendered: false,
                parseHTML: (element) => element.getAttribute('data-note-id'),
            },
        }
    },

    parseHTML() {
        return [{ tag: 'div[data-type="noteReference"]' }]
    },

    renderHTML({ node }) {
        return ['div', { 'data-type': 'noteReference', 'data-note-id': String(node.attrs.noteId) }]
    },

    addNodeView() {
        return this.options.nodeView ?? null
    },

    addKeyboardShortcuts() {
        // Note: Enter on a selected card (reached with the arrow keys) opens it by pressing its button
        return {
            Enter: ({ editor }) => {
                const { selection } = editor.state
                if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) return false
                const element = editor.view.nodeDOM(selection.from)
                if (!(element instanceof HTMLElement)) return false
                element.querySelector<HTMLButtonElement>('button')?.click()
                return true
            },
        }
    },
})
