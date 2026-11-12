import type { NoteDocument } from './block-document'

// Note: the same property sets as the server (backend NoteContentValidator); any other property is rejected
const ALLOWED_PROPERTIES: Record<string, readonly string[]> = {
    paragraph: ['id', 'type', 'text'],
    quote: ['id', 'type', 'text'],
    heading: ['id', 'type', 'text', 'level'],
    bullet: ['id', 'type', 'text', 'children'],
    numbered: ['id', 'type', 'text', 'children'],
    toggle: ['id', 'type', 'text', 'children'],
    checklist: ['id', 'type', 'text', 'checked', 'children'],
    code: ['id', 'type', 'text', 'language'],
    divider: ['id', 'type'],
    reference: ['id', 'type', 'noteId'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The server's block shape, where a container may leave out children and a checklist may leave out checked */
function isStoredBlock(value: unknown): value is Record<string, unknown> {
    if (!isRecord(value) || typeof value.type !== 'string') return false
    const allowed = ALLOWED_PROPERTIES[value.type]
    if (!allowed || Object.keys(value).some((key) => !allowed.includes(key))) return false
    if (typeof value.id !== 'string' || value.id.length === 0) return false
    if (value.type !== 'divider' && value.type !== 'reference' && typeof value.text !== 'string') return false
    if (value.type === 'heading' && value.level !== 1 && value.level !== 2 && value.level !== 3) return false
    if (value.type === 'reference' && (typeof value.noteId !== 'string' || value.noteId.length === 0)) return false
    if ('checked' in value && typeof value.checked !== 'boolean') return false
    if ('language' in value && typeof value.language !== 'string') return false
    return !('children' in value) || isStoredBlockList(value.children)
}

function isStoredBlockList(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.every(isStoredBlock)
}

/** Writes out what the server lets a block leave out: no children means [], no checked means false */
function fillOmittedDefaults(blocks: Record<string, unknown>[]): void {
    for (const block of blocks) {
        if (block.type === 'checklist' && block.checked === undefined) block.checked = false
        if (ALLOWED_PROPERTIES[String(block.type)]?.includes('children')) {
            if (block.children === undefined) block.children = []
            if (isStoredBlockList(block.children)) fillOmittedDefaults(block.children)
        }
    }
}

/**
 * Checks that note content from the API follows the server's document rules, so the editor can open it.
 * It only checks: a missing children or checked is accepted as is (see normalizeNoteDocument). Id format and
 * uniqueness are the server's rules; duplicates are fixed on the editor's output by reissueDuplicateBlockIds.
 */
export function isNoteDocument(value: unknown): value is NoteDocument {
    if (!isRecord(value) || value.schemaVersion !== 1 || !isStoredBlockList(value.blocks)) return false
    return !Object.keys(value).some((key) => key !== 'schemaVersion' && key !== 'blocks')
}

/** A copy of a valid document with the omitted values written out (children [], checked false), or undefined when invalid */
export function normalizeNoteDocument(value: unknown): NoteDocument | undefined {
    if (!isNoteDocument(value)) return undefined
    const copy = structuredClone(value)
    fillOmittedDefaults(copy.blocks as unknown as Record<string, unknown>[])
    return copy
}

/** True when there is nothing written yet: no blocks, or a single paragraph with no text */
export function isEmptyNoteDocument(document: NoteDocument): boolean {
    if (document.blocks.length === 0) return true
    const [onlyBlock] = document.blocks
    return document.blocks.length === 1 && onlyBlock?.type === 'paragraph' && onlyBlock.text === ''
}
