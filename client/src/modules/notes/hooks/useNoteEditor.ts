import type { JSONContent, Range } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { ReferenceCardNodeView } from '../components/ReferenceCardNodeView'
import { ReactNodeViewRenderer, useEditor, type UseEditorOptions } from '@tiptap/react'
import { useMemo, useState } from 'react'
import type { NoteDocument } from '../utils/editor/block-document'
import { reissueDuplicateBlockIds } from '../utils/editor/block-id'
import { isEmptyNoteDocument } from '../utils/editor/note-document-guard'
import { createNoteEditorExtensions } from '../utils/editor/note-editor-extensions'
import { pastedTextToParagraphBlocks } from '../utils/editor/paste-plain-text'
import { createSlashMenuRenderer, insertReferenceCard, type SlashMenuState } from '../utils/editor/slash-command-extension'
import { extractReferenceNoteIds } from '../utils/reference/reference-cards'
import { noteDocumentToTipTap, tipTapToNoteDocument, type TipTapNode } from '../utils/editor/tiptap-converter'

/** Inserts pasted plain text at the selection: one line joins the current text, more lines become paragraphs */
function insertPlainText(view: EditorView, text: string): void {
    const { state } = view
    if (state.selection.$from.parent.type.spec.code) {
        view.dispatch(state.tr.insertText(text.replace(/\r\n?/g, '\n')).scrollIntoView())
        return
    }

    const paragraphs = pastedTextToParagraphBlocks(text)
    const [firstParagraph] = paragraphs
    if (!firstParagraph) return
    if (paragraphs.length === 1) {
        view.dispatch(state.tr.insertText(firstParagraph.text).scrollIntoView())
        return
    }

    // Note: an open slice is what a normal paste uses, so the first line joins the text before the cursor and the
    // last line the text after it, also inside a list item. Each new paragraph already carries a fresh block id
    const nodes = noteDocumentToTipTap({ schemaVersion: 1, blocks: paragraphs }).content.map((json) =>
        state.schema.nodeFromJSON(json),
    )
    view.dispatch(state.tr.replaceSelection(new Slice(Fragment.from(nodes), 1, 1)).scrollIntoView())
}

const NOTE_EDITOR_PROPS: UseEditorOptions['editorProps'] = {
    attributes: {
        class: 'notes-editor-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'เนื้อหาโน้ต',
    },
    // Note: only plain text is ever pasted, so rich HTML (bold, links, images, blocks with old ids) never gets in
    handlePaste: (view, event) => {
        insertPlainText(view, event.clipboardData?.getData('text/plain') ?? '')
        return true
    },
    // Note: content dropped from outside the editor is ignored in this round; moving text inside the editor still works
    handleDrop: (_view, _event, _slice, moved) => !moved,
    // Note: one line per block when copying out, so pasting it back does not add an empty paragraph between lines
    clipboardTextSerializer: (slice) => slice.content.textBetween(0, slice.content.size, '\n'),
}

function toNoteDocument(json: JSONContent): NoteDocument {
    // Note: getJSON() of the doc node always has type 'doc' and an array of block nodes
    const content = (json.content ?? []) as TipTapNode[]
    return reissueDuplicateBlockIds(tipTapToNoteDocument({ type: 'doc', content }))
}

type UseNoteEditorOptions = {
    initialDocument: NoteDocument
    onDocumentChange?: (document: NoteDocument) => void
    /** Shows the text without letting it be changed or taking focus (the conflict page) */
    isReadOnly?: boolean
}

/** Creates the TipTap editor once for the opened note; it is destroyed when the component unmounts */
export function useNoteEditor({ initialDocument, onDocumentChange, isReadOnly = false }: UseNoteEditorOptions) {
    // Note: read once. NotePage remounts this per note (key={note.id}), so another note never shows stale content
    const [startsEmpty] = useState(() => isEmptyNoteDocument(initialDocument))
    const [content] = useState(() => noteDocumentToTipTap(initialDocument))
    const [slashMenu, setSlashMenu] = useState<SlashMenuState>()
    // Note: set while the "/reference" picker is open; holds the typed "/reference" that the chosen card replaces
    const [pickerRange, setPickerRange] = useState<Range>()
    const [extensions] = useState(() =>
        createNoteEditorExtensions(createSlashMenuRenderer(setSlashMenu), {
            nodeView: ReactNodeViewRenderer(ReferenceCardNodeView),
            onChoose: setPickerRange,
        }),
    )
    const [isEmpty, setIsEmpty] = useState(startsEmpty)
    // Note: a string, so an edit that keeps the same cards does not render again or load the card info again
    const [referenceKey, setReferenceKey] = useState(() => extractReferenceNoteIds(initialDocument).join(','))
    const referenceNoteIds = useMemo(() => (referenceKey.length > 0 ? referenceKey.split(',') : []), [referenceKey])

    const editor = useEditor({
        extensions,
        content,
        // Note: only an empty note takes the cursor, so opening a note with content does not steal focus
        editable: !isReadOnly,
        autofocus: startsEmpty && !isReadOnly ? 'start' : false,
        editorProps: NOTE_EDITOR_PROPS,
        onUpdate: ({ editor: currentEditor, transaction }) => {
            // Note: UniqueID fills missing ids right after creation with addToHistory false; that is not an edit
            if (transaction.getMeta('addToHistory') === false) return
            const document = toNoteDocument(currentEditor.getJSON())
            setIsEmpty(isEmptyNoteDocument(document))
            setReferenceKey(extractReferenceNoteIds(document).join(','))
            onDocumentChange?.(document)
        },
    })

    const referencePicker = {
        isOpen: pickerRange !== undefined,
        /** Puts a card for the note at the cursor line and gives the cursor back to the editor */
        pick: (noteId: string) => {
            if (editor && pickerRange) {
                const tr = editor.state.tr
                if (insertReferenceCard(tr, pickerRange, noteId)) editor.view.dispatch(tr)
            }
            setPickerRange(undefined)
            editor?.commands.focus()
        },
        /** Closing without a choice leaves the text as it is and returns the cursor */
        close: () => {
            setPickerRange(undefined)
            editor?.commands.focus()
        },
    }

    return { editor, isEmpty, slashMenu, referenceNoteIds, referencePicker }
}
