import { reissueAllBlockIds, type IdGenerator } from '../editor/block-id'
import { normalizeNoteDocument } from '../editor/note-document-guard'
import type { NoteSnapshot } from './conflict-equivalence'
import { normalizeNoteTitle } from './normalize-note-title'

// Note: the server counts Unicode code points (backend NoteOptions.TitleMaxLength, at most 200)
export const NOTE_TITLE_MAX_CODE_POINTS = 200
const COPY_SUFFIX = ' (สำเนา)'

/** The copy kept by "keep both": the same text, every block id new (nested ones too), the title marked as a copy */
export function copyNoteWithNewBlockIds(snapshot: NoteSnapshot, generateId?: IdGenerator): NoteSnapshot {
    const room = NOTE_TITLE_MAX_CODE_POINTS - Array.from(COPY_SUFFIX).length
    const title = `${Array.from(normalizeNoteTitle(snapshot.title)).slice(0, room).join('')}${COPY_SUFFIX}`
    // Note: content that cannot be read as a document is copied as it is, so its block ids stay the same; the editor
    // does not open such content, so the copy cannot be edited or saved by this tab anyway
    const document = normalizeNoteDocument(snapshot.content)
    return {
        title,
        context: snapshot.context,
        content: document ? reissueAllBlockIds(document, generateId) : snapshot.content,
    }
}
