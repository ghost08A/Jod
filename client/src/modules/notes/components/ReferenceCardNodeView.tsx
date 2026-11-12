import type { NodeViewProps } from '@tiptap/core'
import { NodeViewWrapper } from '@tiptap/react'
import { useContext, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { toReferenceCardView } from '../utils/reference/reference-cards'
import { buildNotePath } from '../utils/shell/note-path'
import { ReferenceCardsContext } from './ReferenceCardsContext'

/** One reference card inside the editor: the target's title with its parent under it, and a click opens the note */
export function ReferenceCardNodeView({ node, editor, getPos, selected }: NodeViewProps) {
    const noteId = typeof node.attrs.noteId === 'string' ? node.attrs.noteId : ''
    const { cards, hasFailed } = useContext(ReferenceCardsContext)
    const navigate = useNavigate()
    const info = cards?.get(noteId)
    const view = info ? toReferenceCardView(info) : undefined

    function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
        if ((event.key !== 'Backspace' && event.key !== 'Delete') || !editor.isEditable) return
        const position = getPos()
        if (position === undefined) return
        event.preventDefault()
        event.stopPropagation()
        editor.chain().setNodeSelection(position).deleteSelection().focus().run()
    }

    return (
        <NodeViewWrapper className="notes-reference" data-selected={selected} contentEditable={false}>
            {view ? (
                <button
                    className="notes-reference-card"
                    type="button"
                    // Note: aria-disabled, not disabled, so a card that cannot open can still be focused and deleted
                    aria-disabled={!view.isClickable}
                    onClick={() => view.isClickable && void navigate(buildNotePath(noteId))}
                    onKeyDown={handleKeyDown}
                >
                    <span className="notes-reference-title">{view.titleLine}</span>
                    {view.parentLine && <span className="notes-reference-parent">{view.parentLine}</span>}
                    {view.label && <span className="notes-reference-label">{view.label}</span>}
                </button>
            ) : hasFailed ? (
                <button className="notes-reference-card" type="button" onKeyDown={handleKeyDown} aria-disabled="true">
                    <span className="notes-reference-title">โหลดข้อมูลการ์ดไม่สำเร็จ</span>
                </button>
            ) : (
                <span className="skeleton notes-reference-skeleton" role="status" aria-label="กำลังโหลด" />
            )}
        </NodeViewWrapper>
    )
}
