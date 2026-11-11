import { EditorContent, useEditorState } from '@tiptap/react'
import { useEffect, useId, useState } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useNoteEditor } from '../hooks/useNoteEditor'
import type { NoteDocument } from '../utils/editor/block-document'
import { indentBlock, outdentBlock } from '../utils/editor/block-nesting'
import { createChildInEditor, indentInEditor, outdentInEditor } from '../utils/editor/nesting-keys'
import { normalizeNoteDocument } from '../utils/editor/note-document-guard'
import { MobileNestingToolbar } from './MobileNestingToolbar'
import { SlashMenu } from './SlashMenu'

type NoteEditorProps = {
    /** The note's content as it came from the API */
    content: unknown
    /** Called after every edit with the whole document, block ids made unique */
    onDocumentChange?: (document: NoteDocument) => void
    /** Shows the content only, without a cursor, hint or editing tools */
    isReadOnly?: boolean
}

export function NoteEditor({ content, onDocumentChange, isReadOnly }: NoteEditorProps) {
    const [initialDocument] = useState(() => normalizeNoteDocument(content))

    if (!initialDocument) {
        // Note: the editor is not opened at all, so content it cannot read is never replaced
        return (
            <ErrorMessage styleScope="notes" message="อ่านเนื้อหาของโน้ตนี้ไม่ได้" />
        )
    }

    return <NoteEditorSurface initialDocument={initialDocument} onDocumentChange={onDocumentChange} isReadOnly={isReadOnly} />
}

type NoteEditorSurfaceProps = {
    initialDocument: NoteDocument
    onDocumentChange?: (document: NoteDocument) => void
    isReadOnly?: boolean
}

function NoteEditorSurface({ initialDocument, onDocumentChange, isReadOnly }: NoteEditorSurfaceProps) {
    const { editor, isEmpty, slashMenu } = useNoteEditor({ initialDocument, onDocumentChange, isReadOnly })
    const slashListId = useId()
    const status = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            isFocused: current?.isFocused ?? false,
            canIndent: current ? indentBlock(current.state) : false,
            canOutdent: current ? outdentBlock(current.state) : false,
        }),
    })
    const isFocused = status?.isFocused ?? false
    const activeCommand = slashMenu?.items[slashMenu.activeIndex]
    const activeOptionId = isFocused && activeCommand ? `${slashListId}-${activeCommand.name}` : undefined

    // Note: focus stays in the editor while the menu is open, so the editor points screen readers at the highlighted option
    useEffect(() => {
        if (!editor || !activeOptionId) return
        const editorElement = editor.view.dom
        editorElement.setAttribute('aria-controls', slashListId)
        editorElement.setAttribute('aria-activedescendant', activeOptionId)
        return () => {
            editorElement.removeAttribute('aria-controls')
            editorElement.removeAttribute('aria-activedescendant')
        }
    }, [editor, activeOptionId, slashListId])

    return (
        <div className="notes-editor">
            {isEmpty && !isReadOnly && (
                <p className="notes-editor-hint" aria-hidden="true">
                    พิมพ์เนื้อหาที่นี่…
                </p>
            )}
            <EditorContent editor={editor} />
            {isFocused && slashMenu && <SlashMenu menu={slashMenu} listId={slashListId} />}
            {isFocused && editor && status && (
                <MobileNestingToolbar
                    canIndent={status.canIndent}
                    canOutdent={status.canOutdent}
                    onIndent={() => indentInEditor(editor)}
                    onOutdent={() => outdentInEditor(editor)}
                    onCreateChild={() => createChildInEditor(editor)}
                />
            )}
        </div>
    )
}
