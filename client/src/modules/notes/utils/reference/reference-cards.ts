import type { ReferenceCardInfo } from '../../types/note'
import { normalizeNoteTitle } from '../autosave/normalize-note-title'
import { isContainerBlock, type NoteBlock, type NoteDocument } from '../editor/block-document'

/** The target ids of every card in the document: reading order, any depth, each id once */
export function extractReferenceNoteIds(document: NoteDocument): string[] {
    const ids = new Set<string>()
    const walk = (blocks: readonly NoteBlock[]) => {
        for (const block of blocks) {
            if (block.type === 'reference') ids.add(block.noteId)
            if (isContainerBlock(block)) walk(block.children)
        }
    }
    walk(document.blocks)
    return [...ids]
}

/** A copy of the document with the card right after the block that has this id, in the same list. Last at the top when the id is not found */
export function insertReferenceAfter(document: NoteDocument, afterBlockId: string, card: NoteBlock): NoteDocument {
    let isInserted = false
    const insertInto = (blocks: readonly NoteBlock[]): NoteBlock[] =>
        blocks.flatMap((block) => {
            const copy = isContainerBlock(block) ? { ...block, children: insertInto(block.children) } : block
            if (block.id !== afterBlockId || isInserted) return [copy]
            isInserted = true
            return [copy, card]
        })
    const blocks = insertInto(document.blocks)
    return { schemaVersion: 1, blocks: isInserted ? blocks : [...blocks, card] }
}

export type ReferenceCardView = {
    titleLine: string
    /** The small line under the title; undefined shows nothing */
    parentLine: string | undefined
    /** A short status such as "อยู่ใน Trash" */
    label: string | undefined
    isClickable: boolean
}

function toParentLine(info: ReferenceCardInfo): string | undefined {
    if (info.placement === 'unplaced') return 'รอจัดวาง'
    return info.placement === 'child' && info.parentTitle !== null ? normalizeNoteTitle(info.parentTitle) : undefined
}

/** What one card shows for what the server answered about its target */
export function toReferenceCardView(info: ReferenceCardInfo): ReferenceCardView {
    if (info.status === 'missing') {
        return { titleLine: 'Note นี้ไม่มีแล้ว', parentLine: undefined, label: undefined, isClickable: false }
    }
    return {
        titleLine: normalizeNoteTitle(info.title ?? ''),
        parentLine: toParentLine(info),
        label: info.status === 'trashed' ? 'อยู่ใน Trash' : undefined,
        isClickable: true,
    }
}
