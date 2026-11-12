import { Node, type Extensions, type KeyboardShortcutCommand, type NodeViewRenderer, type Range } from '@tiptap/core'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { UniqueID } from '@tiptap/extension-unique-id'
import { StarterKit } from '@tiptap/starter-kit'
import type { HeadingLevel } from './block-document'
import { defaultGenerateBlockId } from './block-id'
import { NestingKeys } from './nesting-keys'
import { NoteReference } from './note-reference-node'
import { SlashCommand, type SlashMenuRenderer } from './slash-command-extension'

const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3]

/** Every TipTap node that is one Jod block. The list wrappers (bulletList, orderedList, taskList) are not blocks */
const BLOCK_NODE_TYPES = [
    'paragraph',
    'heading',
    'blockquote',
    'codeBlock',
    'horizontalRule',
    'listItem',
    'taskItem',
    'details',
    'noteReference',
]

function isHeadingLevel(value: unknown): value is HeadingLevel {
    return HEADING_LEVELS.some((level) => level === value)
}

/**
 * StarterKit with the two nodes the Jod model restricts: a quote holds one paragraph (no children),
 * and a heading level outside 1-3 is rejected by the schema instead of being stored.
 */
const RestrictedStarterKit = StarterKit.extend({
    addExtensions() {
        return (this.parent?.() ?? []).map((extension) => {
            if (!(extension instanceof Node)) return extension
            if (extension.name === 'blockquote') {
                return extension.extend({
                    content: 'paragraph',
                    addKeyboardShortcuts() {
                        // Note: a quote cannot hold a second paragraph, so Enter in a non-empty quote starts a new quote
                        // (like Enter in a list item). On an empty quote the default Enter lifts it back to a paragraph
                        const splitQuote: KeyboardShortcutCommand = ({ editor }) => {
                            const { $from, empty } = editor.state.selection
                            const isInQuote = $from.depth >= 2 && $from.node(-1).type.name === 'blockquote'
                            if (!isInQuote || (empty && $from.parent.content.size === 0)) return false
                            return editor.commands.command(({ tr }) => {
                                tr.deleteSelection()
                                tr.split(tr.selection.from, 2)
                                return true
                            })
                        }
                        return { ...this.parent?.(), Enter: splitQuote }
                    },
                })
            }
            if (extension.name === 'heading') {
                return extension.extend({
                    addAttributes() {
                        // Note: the same level attribute as @tiptap/extension-heading 3.33 (default 1, not rendered) plus a check
                        return {
                            ...this.parent?.(),
                            level: {
                                default: 1,
                                rendered: false,
                                validate: (value: unknown) => {
                                    if (!isHeadingLevel(value)) throw new RangeError('Heading level must be 1, 2 or 3')
                                },
                            },
                        }
                    },
                })
            }
            return extension
        })
    },
})

/** Mod-Enter ticks or unticks the checklist item that holds the cursor, so the checkbox works from the keyboard */
const KeyboardTaskItem = TaskItem.extend({
    addKeyboardShortcuts() {
        const toggleChecked: KeyboardShortcutCommand = ({ editor }) => {
            const { $from } = editor.state.selection
            for (let depth = $from.depth; depth > 0; depth -= 1) {
                const node = $from.node(depth)
                if (node.type.name === this.name) {
                    const position = $from.before(depth)
                    return editor.commands.command(({ tr }) => {
                        tr.setNodeMarkup(position, undefined, { ...node.attrs, checked: !node.attrs.checked })
                        return true
                    })
                }
            }
            return false
        }
        return { ...this.parent?.(), 'Mod-Enter': toggleChecked }
    },
})

/** Mod-Enter in a toggle's summary opens or closes it. The open state lives only in the node view (never stored) */
const KeyboardDetails = Details.extend({
    addKeyboardShortcuts() {
        const toggleOpen: KeyboardShortcutCommand = ({ editor }) => {
            const { $from } = editor.state.selection
            if ($from.parent.type.name !== 'detailsSummary') return false
            const detailsElement = editor.view.nodeDOM($from.before(-1))
            if (!(detailsElement instanceof HTMLElement)) return false
            detailsElement.querySelector<HTMLButtonElement>(':scope > button')?.click()
            return true
        }
        return { ...this.parent?.(), 'Mod-Enter': toggleOpen }
    },
})

export type ReferenceCardOptions = {
    /** Draws a card inside the editor */
    nodeView?: NodeViewRenderer
    /** Called when "/reference" is chosen, with the typed "/query" range that the chosen card replaces */
    onChoose?: (range: Range) => void
}

/** renderSlashMenu draws the "/" menu; without it the menu still works but shows nothing (as in tests) */
export function createNoteEditorExtensions(renderSlashMenu?: SlashMenuRenderer, referenceCards: ReferenceCardOptions = {}): Extensions {
    return [
        RestrictedStarterKit.configure({
            // Note: block text is plain text, so every mark and the line break inside a paragraph are off
            bold: false,
            italic: false,
            strike: false,
            underline: false,
            code: false,
            link: false,
            hardBreak: false,
            // Note: dropping content is blocked in this round (see useNoteEditor), so there is nothing to show a drop line for
            dropcursor: false,
            // Note: off so that opening a note never adds an empty paragraph the user did not write
            trailingNode: false,
            heading: { levels: HEADING_LEVELS },
        }),
        TaskList,
        KeyboardTaskItem.configure({
            nested: true,
            a11y: {
                checkboxLabel: (node) => {
                    const text = node.firstChild?.textContent ?? ''
                    return text.length > 0 ? `ทำเสร็จแล้ว: ${text}` : 'ทำเสร็จแล้ว'
                },
            },
        }),
        KeyboardDetails.configure({
            // Note: the open state is UI-only; with persist off every toggle opens closed and nothing is stored
            persist: false,
            renderToggleButton: ({ element, isOpen }) => {
                element.setAttribute('aria-label', isOpen ? 'ยุบเนื้อหา' : 'ขยายเนื้อหา')
                element.setAttribute('aria-expanded', String(isOpen))
            },
        }),
        DetailsSummary,
        // Note: the package requires at least one block inside a toggle; a Jod toggle may have no children
        DetailsContent.extend({ content: 'block*' }),
        UniqueID.configure({
            attributeName: 'id',
            types: BLOCK_NODE_TYPES,
            // Note: a wrapper, because UniqueID passes a context object that generateBlockId would take as its generator
            generateID: () => defaultGenerateBlockId(),
        }),
        NoteReference.configure({ nodeView: referenceCards.nodeView }),
        SlashCommand.configure({ render: renderSlashMenu, onChooseReference: referenceCards.onChoose }),
        NestingKeys,
    ]
}
