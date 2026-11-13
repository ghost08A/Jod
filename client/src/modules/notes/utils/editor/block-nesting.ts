import { chainCommands } from '@tiptap/pm/commands'
import { Fragment, type Node as ProseMirrorNode, type NodeType } from '@tiptap/pm/model'
import {
    NodeSelection,
    TextSelection,
    type Command,
    type Selection,
    type Transaction,
} from '@tiptap/pm/state'

/** One Jod block in the editor: the node and the document position just before it */
export type BlockLocation = {
    node: ProseMirrorNode
    pos: number
}

const BLOCK_TYPES = [
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
const LIST_WRAPPER_TYPES = ['bulletList', 'orderedList', 'taskList']

function isListItem(node: ProseMirrorNode): boolean {
    return node.type.name === 'listItem' || node.type.name === 'taskItem'
}

function isListWrapper(node: ProseMirrorNode): boolean {
    return LIST_WRAPPER_TYPES.includes(node.type.name)
}

/** The text line of a list item, a quote's paragraph and a toggle's summary belong to the block around them */
function isTextOfOuterBlock(node: ProseMirrorNode, parent: ProseMirrorNode, index: number): boolean {
    if (node.type.name !== 'paragraph') return false
    return parent.type.name === 'blockquote' || (isListItem(parent) && index === 0)
}

/** The Jod block that holds the start of the selection (a selected divider is its own block) */
export function findCurrentBlock(selection: Selection): BlockLocation | undefined {
    if (selection instanceof NodeSelection) {
        return BLOCK_TYPES.includes(selection.node.type.name)
            ? { node: selection.node, pos: selection.from }
            : undefined
    }
    const { $from } = selection
    for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth)
        if (isTextOfOuterBlock(node, $from.node(depth - 1), $from.index(depth - 1))) continue
        if (BLOCK_TYPES.includes(node.type.name)) return { node, pos: $from.before(depth) }
    }
    return undefined
}

/** The list type a list item needs around it (bullet, numbered or checklist); undefined for other blocks */
export function listWrapperTypeOf(doc: ProseMirrorNode, block: BlockLocation): NodeType | undefined {
    return isListItem(block.node) ? doc.resolve(block.pos).parent.type : undefined
}

/** The block right before this one at the same level, if it can hold children (list item, checklist item or toggle) */
export function findPreviousContainer(doc: ProseMirrorNode, block: BlockLocation): BlockLocation | undefined {
    let $slot = doc.resolve(block.pos)
    if (isListItem(block.node)) {
        const index = $slot.index()
        if (index > 0) {
            const previous = $slot.parent.child(index - 1)
            return { node: previous, pos: block.pos - previous.nodeSize }
        }
        $slot = doc.resolve($slot.before())
    }
    // Note: inside a list item the first child is the item's own text, so the children start at index 1
    const firstChildIndex = isListItem($slot.parent) ? 1 : 0
    const index = $slot.index()
    if (index <= firstChildIndex) return undefined
    const previous = $slot.parent.child(index - 1)
    const previousPos = $slot.pos - previous.nodeSize
    if (isListWrapper(previous) && previous.lastChild) {
        return { node: previous.lastChild, pos: previousPos + previous.nodeSize - 1 - previous.lastChild.nodeSize }
    }
    return previous.type.name === 'details' ? { node: previous, pos: previousPos } : undefined
}

/** The list item or toggle that holds this block as a child; undefined at the top level */
function findParentContainer(doc: ProseMirrorNode, block: BlockLocation): BlockLocation | undefined {
    const $before = doc.resolve(block.pos)
    let depth = isListItem(block.node) ? $before.depth - 1 : $before.depth
    if ($before.node(depth).type.name === 'detailsContent') depth -= 1
    return depth > 0 ? { node: $before.node(depth), pos: $before.before(depth) } : undefined
}

/** The position after the last child of a list item or toggle */
function childrenEndOf(container: BlockLocation): number {
    const closingTokens = container.node.type.name === 'details' ? 2 : 1
    return container.pos + container.node.nodeSize - closingTokens
}

/** The children of a list item (everything after its text) or of a toggle */
export function childBlocksOf(node: ProseMirrorNode): Fragment {
    if (isListItem(node)) return node.content.cut(node.firstChild?.nodeSize ?? 0)
    if (node.type.name === 'details') return node.lastChild?.content ?? Fragment.empty
    return Fragment.empty
}

/**
 * Inserts one block at a position between blocks. A list item gets its list around it, joining the list right
 * before it when that is the same kind. Returns the position just before the inserted block.
 */
export function insertBlock(
    tr: Transaction,
    pos: number,
    block: ProseMirrorNode,
    wrapperType: NodeType | undefined,
): number {
    const $pos = tr.doc.resolve(pos)
    const parent = $pos.parent
    if (wrapperType && parent.type === wrapperType) {
        tr.insert(pos, block)
        return pos
    }
    if (wrapperType && $pos.nodeBefore?.type === wrapperType) {
        tr.insert(pos - 1, block)
        return pos - 1
    }
    let insertPos = pos
    if (isListWrapper(parent)) {
        // Note: a block that is not this kind of list item cannot sit inside the list, so it goes before or after
        // the list, or the list is split in two around it
        if ($pos.index() === 0) insertPos = $pos.before()
        else if ($pos.index() === parent.childCount) insertPos = $pos.after()
        else {
            tr.split(pos)
            insertPos = pos + 1
        }
    }
    tr.insert(insertPos, wrapperType ? wrapperType.create(null, block) : block)
    return wrapperType ? insertPos + 1 : insertPos
}

/** Deletes a block; a list item that is alone in its list takes the list with it */
export function removeBlock(tr: Transaction, block: BlockLocation): void {
    const $before = tr.doc.resolve(block.pos)
    if (isListItem(block.node) && $before.parent.childCount === 1) {
        tr.delete($before.before(), $before.after())
        return
    }
    tr.delete(block.pos, block.pos + block.node.nodeSize)
}

/** Puts the selection back at the same place inside a block that now starts at newPos */
function keepSelectionInMovedBlock(tr: Transaction, selection: Selection, block: BlockLocation, newPos: number) {
    const shift = newPos - block.pos
    if (selection instanceof NodeSelection) {
        tr.setSelection(NodeSelection.create(tr.doc, newPos))
        return
    }
    const to = selection.to <= block.pos + block.node.nodeSize ? selection.to : selection.from
    tr.setSelection(TextSelection.create(tr.doc, selection.from + shift, to + shift))
}

/** Inserts the block at a new place, deletes it from the old one and keeps the cursor in it, in one transaction */
function moveBlock(
    tr: Transaction,
    selection: Selection,
    block: BlockLocation,
    targetPos: number,
): void {
    const wrapperType = listWrapperTypeOf(tr.doc, block)
    const insertedAt = insertBlock(tr, targetPos, block.node, wrapperType)
    const stepsBeforeRemove = tr.steps.length
    // Note: the target (inside the container before the block) lies before the block, so mapping the old position
    // through the insertion finds the block again
    const shiftedBlock = { node: block.node, pos: tr.mapping.map(block.pos, 1) }
    removeBlock(tr, shiftedBlock)
    const newPos = tr.mapping.slice(stepsBeforeRemove).map(insertedAt)
    keepSelectionInMovedBlock(tr, selection, block, newPos)
    tr.scrollIntoView()
}

/**
 * Tab: the block becomes the last child of the block before it at the same level, when that one is a list item,
 * checklist item or toggle. Returns false (and changes nothing) after a leaf block or at the first position.
 */
export const indentBlock: Command = (state, dispatch) => {
    const block = findCurrentBlock(state.selection)
    if (!block) return false
    const container = findPreviousContainer(state.doc, block)
    if (!container) return false
    if (dispatch) {
        const tr = state.tr
        moveBlock(tr, state.selection, block, childrenEndOf(container))
        dispatch(tr)
    }
    return true
}

/** Appends blocks to a block list, joining two lists of the same kind where they meet */
function appendBlocks(content: Fragment, more: Fragment): Fragment {
    const last = content.lastChild
    const first = more.firstChild
    if (!last || !first || !isListWrapper(last) || last.type !== first.type) return content.append(more)
    const joined = last.copy(last.content.append(first.content))
    return content.replaceChild(content.childCount - 1, joined).append(more.cut(first.nodeSize))
}

/** A list item or toggle with more blocks added after its own children */
function withMoreChildren(container: ProseMirrorNode, more: Fragment): ProseMirrorNode {
    if (container.type.name !== 'details') return container.copy(appendBlocks(container.content, more))
    const summary = container.firstChild
    const content = container.lastChild
    if (!summary || !content) return container
    return container.copy(Fragment.from([summary, content.copy(appendBlocks(content.content, more))]))
}

/**
 * Shift+Tab: the block leaves its list item or toggle and becomes the block right after it. The reading order is
 * kept: the blocks that came after it become its last children, or, when it cannot hold children, leave with it
 * and follow it. False at the top level.
 */
export const outdentBlock: Command = (state, dispatch) => {
    const block = findCurrentBlock(state.selection)
    if (!block) return false
    const parent = findParentContainer(state.doc, block)
    if (!parent) return false
    if (!dispatch) return true

    const { doc } = state
    const wrapperType = listWrapperTypeOf(doc, block)
    const $before = doc.resolve(block.pos)
    const blockEnd = block.pos + block.node.nodeSize
    // Note: the blocks after this one at the same level: the rest of its own list (kept in a list of that kind),
    // then everything after that list or after the block, up to the end of the parent's children
    let laterSiblings = Fragment.empty
    let slotEnd = blockEnd
    let removeFrom = block.pos
    if (wrapperType) {
        const laterItems = doc.slice(blockEnd, $before.end()).content
        if (laterItems.size > 0) laterSiblings = Fragment.from($before.parent.copy(laterItems))
        slotEnd = $before.after()
        removeFrom = $before.index() === 0 ? $before.before() : block.pos
    }
    const childrenEnd = childrenEndOf(parent)
    laterSiblings = laterSiblings.append(doc.slice(slotEnd, childrenEnd).content)

    const tr = state.tr
    const isContainer = isListItem(block.node) || block.node.type.name === 'details'
    const moved = isContainer ? withMoreChildren(block.node, laterSiblings) : block.node
    const insertedAt = insertBlock(tr, parent.pos + parent.node.nodeSize, moved, wrapperType)
    if (!isContainer && laterSiblings.size > 0) tr.insert(insertedAt + moved.nodeSize, laterSiblings)

    // Note: both deletions lie before the insertion, the later range first so the earlier positions stay valid
    const stepsBeforeRemove = tr.steps.length
    tr.delete(slotEnd, childrenEnd)
    tr.delete(removeFrom, removeFrom === block.pos && wrapperType ? $before.end() : slotEnd)
    const newPos = tr.mapping.slice(stepsBeforeRemove).map(insertedAt)
    keepSelectionInMovedBlock(tr, state.selection, block, newPos)
    dispatch(tr.scrollIntoView())
    return true
}

/**
 * Shift+Enter that leaves the current place: in a quote (at any level), a new empty paragraph right after the quote;
 * in another leaf block that is a child of a list item or toggle, one right after that parent (one level up).
 * The cursor goes into it and nothing else moves. False for other blocks and for other top-level leaf blocks.
 */
export const addParagraphAfterBlock: Command = (state, dispatch) => {
    const block = findCurrentBlock(state.selection)
    if (!block || isListItem(block.node) || block.node.type.name === 'details') return false
    const target = block.node.type.name === 'blockquote' ? block : findParentContainer(state.doc, block)
    if (!target) return false
    if (dispatch) {
        const tr = state.tr
        const paragraph = state.schema.nodes.paragraph.create()
        const paragraphPos = insertBlock(tr, target.pos + target.node.nodeSize, paragraph, undefined)
        tr.setSelection(TextSelection.create(tr.doc, paragraphPos + 1))
        dispatch(tr.scrollIntoView())
    }
    return true
}

/** Shift+Enter in the text of a bullet, numbered or checklist item: a new empty paragraph as its first child */
export const createChildParagraph: Command = (state, dispatch) => {
    const block = findCurrentBlock(state.selection)
    const itemText = block?.node.firstChild
    if (!block || !isListItem(block.node) || !itemText) return false
    if (dispatch) {
        const insertPos = block.pos + 1 + itemText.nodeSize
        const tr = state.tr.insert(insertPos, state.schema.nodes.paragraph.create())
        tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
        dispatch(tr.scrollIntoView())
    }
    return true
}

/** Shift+Enter: a child paragraph in a list item's own text, otherwise a paragraph after a quote or after the parent */
export const createChildOrExitBlock: Command = chainCommands(createChildParagraph, addParagraphAfterBlock)
