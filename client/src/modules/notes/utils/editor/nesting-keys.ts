import { Extension, type Editor, type KeyboardShortcutCommand } from '@tiptap/core'
import {
    createChildOrExitBlock,
    findCurrentBlock,
    findPreviousContainer,
    indentBlock,
    outdentBlock,
} from './block-nesting'
import { isSlashMenuOpen, openToggleAt } from './slash-command-extension'

/** Tab nesting. A closed toggle that receives the block is opened first, so the cursor never lands in hidden content */
export function indentInEditor(editor: Editor): void {
    const block = findCurrentBlock(editor.state.selection)
    const target = block && findPreviousContainer(editor.state.doc, block)
    if (target?.node.type.name === 'details') openToggleAt(editor, target.pos)
    indentBlock(editor.state, editor.view.dispatch)
}

export function outdentInEditor(editor: Editor): void {
    outdentBlock(editor.state, editor.view.dispatch)
}

/**
 * Shift+Enter: a child paragraph in a list item's own text, a paragraph after a quote, a paragraph after the parent
 * when in a child leaf block, anywhere else exactly what Enter does
 */
export function createChildInEditor(editor: Editor): boolean {
    if (createChildOrExitBlock(editor.state, editor.view.dispatch)) return true
    const { view } = editor
    const enter = new KeyboardEvent('keydown', { key: 'Enter' })
    return view.someProp('handleKeyDown', (handleKeyDown) => handleKeyDown(view, enter)) ?? false
}

/** While the slash menu is open its own keys win; otherwise the key runs and is always taken */
function whenMenuClosed(run: (editor: Editor) => unknown): KeyboardShortcutCommand {
    return ({ editor }) => {
        if (isSlashMenuOpen(editor.state)) return false
        run(editor)
        return true
    }
}

/**
 * Tab / Shift+Tab nest and lift any block, Shift+Enter makes a child block, Escape leaves the editor.
 * Tab is always taken inside the editor, even when nothing can move, so focus never jumps out by accident.
 */
export const NestingKeys = Extension.create({
    name: 'nestingKeys',
    // Note: above the list item keys, which would otherwise sink or lift only list items
    priority: 1000,

    addKeyboardShortcuts() {
        return {
            Tab: whenMenuClosed(indentInEditor),
            'Shift-Tab': whenMenuClosed(outdentInEditor),
            'Shift-Enter': whenMenuClosed(createChildInEditor),
            Escape: whenMenuClosed((editor) => editor.view.dom.blur()),
        }
    },
})
