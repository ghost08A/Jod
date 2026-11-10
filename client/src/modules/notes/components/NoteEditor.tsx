import { EditorContent } from '@tiptap/react'
import { useState } from 'react'
import { useNoteEditor } from '../hooks/useNoteEditor'
import type { NoteDocument } from '../utils/editor/block-document'
import { isNoteDocument } from '../utils/editor/note-document-guard'

type NoteEditorProps = {
    /** The note's content as it came from the API */
    content: unknown
    /** Called after every edit with the whole document, block ids made unique */
    onDocumentChange?: (document: NoteDocument) => void
}

export function NoteEditor({ content, onDocumentChange }: NoteEditorProps) {
    const [initialDocument] = useState(() => (isNoteDocument(content) ? content : undefined))

    if (!initialDocument) {
        // Note: the editor is not opened at all, so content it cannot read is never replaced
        return (
            <div className="notes-error" role="alert">
                <p>อ่านเนื้อหาของโน้ตนี้ไม่ได้</p>
            </div>
        )
    }

    return <NoteEditorSurface initialDocument={initialDocument} onDocumentChange={onDocumentChange} />
}

type NoteEditorSurfaceProps = {
    initialDocument: NoteDocument
    onDocumentChange?: (document: NoteDocument) => void
}

function NoteEditorSurface({ initialDocument, onDocumentChange }: NoteEditorSurfaceProps) {
    const { editor, isEmpty } = useNoteEditor({ initialDocument, onDocumentChange })

    return (
        <div className="notes-editor">
            {isEmpty && (
                <p className="notes-editor-hint" aria-hidden="true">
                    พิมพ์เนื้อหาที่นี่…
                </p>
            )}
            <EditorContent editor={editor} />
        </div>
    )
}
