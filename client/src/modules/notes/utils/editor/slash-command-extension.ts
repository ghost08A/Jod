import { Extension, type Editor, type Range } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode, type NodeType } from '@tiptap/pm/model'
import { PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Suggestion, type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'
import { childBlocksOf, findCurrentBlock, insertBlock, removeBlock } from './block-nesting'
import { filterAndRankSlashCommands, type SlashCommandItem } from './slash-commands'
import { isSlashTriggerAllowed } from './slash-trigger'

export const SLASH_MENU_PLUGIN_KEY = new PluginKey('slashMenu')

export function isSlashMenuOpen(state: EditorState): boolean {
    const pluginState: unknown = SLASH_MENU_PLUGIN_KEY.getState(state)
    return typeof pluginState === 'object' && pluginState !== null && 'active' in pluginState && pluginState.active === true
}

/** Inserts a block without text after the block (the block goes when it is an empty line) and an empty paragraph to type in */
function insertAtomBlock(tr: Transaction, block: { node: ProseMirrorNode; pos: number }, atom: ProseMirrorNode): void {
    const { paragraph } = tr.doc.type.schema.nodes
    const atomPos = insertBlock(tr, block.pos + block.node.nodeSize, atom, undefined)
    const paragraphPos = atomPos + 1
    tr.insert(paragraphPos, paragraph.create())
    const stepsBeforeRemove = tr.steps.length
    if (block.node.isTextblock && block.node.content.size === 0) removeBlock(tr, block)
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.slice(stepsBeforeRemove).map(paragraphPos) + 1))
}

/**
 * Replaces the typed "/query" with the chosen block in the transaction: the block that holds the cursor turns into
 * the chosen type, keeping its id, text and children (a block that cannot hold children puts them right after it),
 * and the cursor stays at the same place in the text. Returns the position before the new block.
 */
export function applySlashCommand(tr: Transaction, range: Range, item: SlashCommandItem): number | undefined {
    tr.delete(range.from, range.to)
    const block = findCurrentBlock(tr.selection)
    if (!block) return undefined
    if (item.blockType === 'divider') {
        insertAtomBlock(tr, block, tr.doc.type.schema.nodes.horizontalRule.create())
        return undefined
    }

    const nodes = tr.doc.type.schema.nodes
    const { $from } = tr.selection
    const text = $from.parent.content
    const attrs = { id: block.node.attrs.id ?? null }
    const children = childBlocksOf(block.node)
    const withText = (rest: Fragment) => Fragment.from(nodes.paragraph.create(null, text)).append(rest)

    let newBlock: ProseMirrorNode
    let wrapperType: NodeType | undefined
    switch (item.blockType) {
        case 'reference':
            // Note: never reached from the menu: "/reference" opens the picker, and insertReferenceCard places the card
            return undefined
        case 'paragraph':
            newBlock = nodes.paragraph.create(attrs, text)
            break
        case 'heading':
            newBlock = nodes.heading.create({ ...attrs, level: item.headingLevel ?? 1 }, text)
            break
        case 'code':
            newBlock = nodes.codeBlock.create(attrs, text)
            break
        case 'quote':
            newBlock = nodes.blockquote.create(attrs, withText(Fragment.empty))
            break
        case 'bullet':
        case 'numbered':
            newBlock = nodes.listItem.create(attrs, withText(children))
            wrapperType = item.blockType === 'bullet' ? nodes.bulletList : nodes.orderedList
            break
        case 'checklist':
            newBlock = nodes.taskItem.create({ ...attrs, checked: block.node.attrs.checked === true }, withText(children))
            wrapperType = nodes.taskList
            break
        case 'toggle':
            newBlock = nodes.details.create(attrs, [
                nodes.detailsSummary.create(null, text),
                nodes.detailsContent.create(null, children),
            ])
            break
    }

    const insertedAt = insertBlock(tr, block.pos + block.node.nodeSize, newBlock, wrapperType)
    const keepsChildren = ['bullet', 'numbered', 'checklist', 'toggle'].includes(item.blockType)
    if (!keepsChildren && children.size > 0) tr.insert(insertedAt + newBlock.nodeSize, children)
    const stepsBeforeRemove = tr.steps.length
    removeBlock(tr, block)
    const newPos = tr.mapping.slice(stepsBeforeRemove).map(insertedAt)
    // Note: text starts 1 position into a paragraph, heading or code block and 2 into a quote, list item or toggle
    const textStart = newPos + (newBlock.isTextblock ? 1 : 2)
    tr.setSelection(TextSelection.create(tr.doc, textStart + $from.parentOffset))
    tr.scrollIntoView()
    return newPos
}

/** Replaces the typed "/reference" with a card for the note, at the line that holds the cursor. False when there is no line */
export function insertReferenceCard(tr: Transaction, range: Range, noteId: string): boolean {
    // Note: the picker was open, so the typed text is checked again before it is removed
    const isRangeTyped = range.to <= tr.doc.content.size && tr.doc.textBetween(range.from, range.to).startsWith('/')
    if (isRangeTyped) tr.delete(range.from, range.to)
    const block = findCurrentBlock(tr.selection)
    if (!block) return false
    insertAtomBlock(tr, block, tr.doc.type.schema.nodes.noteReference.create({ noteId }))
    return true
}

/** Opens a closed toggle. The open state lives only in the node view (never stored), so its button is pressed */
export function openToggleAt(editor: Editor, pos: number): void {
    const element = editor.view.nodeDOM(pos)
    if (!(element instanceof HTMLElement) || element.classList.contains('is-open')) return
    element.querySelector<HTMLButtonElement>(':scope > button')?.click()
}

export type SlashMenuState = {
    items: SlashCommandItem[]
    activeIndex: number
    /** The rectangle of the typed "/query" on screen */
    clientRect: (() => DOMRect | null) | null | undefined
    select: (index: number) => void
}

export type SlashMenuRenderer = NonNullable<SuggestionOptions<SlashCommandItem, SlashCommandItem>['render']>

/**
 * Keeps the menu state (items, highlighted item) outside React and reports every change, so the key handling
 * always reads the current state. Up/Down move, Enter or Tab choose, Escape only closes (the plugin keeps the text).
 */
export function createSlashMenuRenderer(onChange: (menu: SlashMenuState | undefined) => void): SlashMenuRenderer {
    return () => {
        let props: SuggestionProps<SlashCommandItem, SlashCommandItem> | undefined
        let activeIndex = 0

        const select = (index: number) => {
            const item = props?.items[index]
            if (item) props?.command(item)
        }
        const show = (next: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
            if (next.query !== props?.query) activeIndex = 0
            props = next
            // Note: the plugin first reports an empty list while it fetches the items; that would flash "no results"
            if (!next.loading) onChange({ items: next.items, activeIndex, clientRect: next.clientRect, select })
        }
        const moveBy = (step: number) => {
            const count = props?.items.length ?? 0
            if (!props || count === 0) return false
            activeIndex = (activeIndex + step + count) % count
            show(props)
            return true
        }

        return {
            onStart: show,
            onUpdate: show,
            onExit: () => {
                props = undefined
                onChange(undefined)
            },
            onKeyDown: ({ event }) => {
                switch (event.key) {
                    case 'ArrowDown':
                        return moveBy(1)
                    case 'ArrowUp':
                        return moveBy(-1)
                    case 'Enter':
                    case 'Tab':
                        if (!props?.items.length) return event.key === 'Tab'
                        select(activeIndex)
                        return true
                    case 'Escape':
                        return true
                    default:
                        return false
                }
            },
        }
    }
}

type SlashCommandOptions = {
    render: SlashMenuRenderer | undefined
    /** "/reference" opens a picker instead of changing the line; the text stays until a note is chosen */
    onChooseReference: ((range: Range) => void) | undefined
}

/**
 * The "/" menu: exactly the commands in SLASH_COMMAND_ITEMS, opened by a "/" at the start of a line or after a space,
 * never inside a code block
 */
export const SlashCommand = Extension.create<SlashCommandOptions>({
    name: 'slashCommand',
    // Note: above the list and paragraph keys, so Enter and Tab choose a command while the menu is open
    priority: 1000,

    addOptions() {
        return { render: undefined, onChooseReference: undefined }
    },

    addProseMirrorPlugins() {
        return [
            Suggestion<SlashCommandItem, SlashCommandItem>({
                editor: this.editor,
                pluginKey: SLASH_MENU_PLUGIN_KEY,
                char: '/',
                // Note: isSlashTriggerAllowed decides which character may come before the "/"
                allowedPrefixes: null,
                allow: ({ state, range }) => {
                    const $slash = state.doc.resolve(range.from)
                    // Note: a "/" in a code block is code, never a command
                    if ($slash.parent.type.spec.code) return false
                    return isSlashTriggerAllowed(state.doc.textBetween($slash.start(), range.from))
                },
                items: ({ query }) => filterAndRankSlashCommands(query),
                command: ({ editor, range, props: item }) => {
                    if (item.name === 'reference') {
                        this.options.onChooseReference?.(range)
                        return
                    }
                    const tr = editor.state.tr
                    const blockPos = applySlashCommand(tr, range, item)
                    editor.view.dispatch(tr)
                    // Note: a toggle made from the menu starts open
                    if (item.blockType === 'toggle' && blockPos !== undefined) openToggleAt(editor, blockPos)
                },
                render: this.options.render,
            }),
        ]
    },
})
