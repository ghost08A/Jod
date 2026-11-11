import { reissueAllBlockIds, type IdGenerator } from '../editor/block-id'
import { isNoteDocument } from '../editor/note-document-guard'
import type { NoteSnapshot } from './conflict-equivalence'
import { normalizeNoteTitle } from './normalize-note-title'

// Note: the server counts Unicode code points (backend NoteOptions.TitleMaxLength, at most 200)
export const NOTE_TITLE_MAX_CODE_POINTS = 200
const COPY_SUFFIX = ' (สำเนา)'

/** The copy kept by "keep both": the same text, every block id new (nested ones too), the title marked as a copy */
export function copyNoteWithNewBlockIds(snapshot: NoteSnapshot, generateId?: IdGenerator): NoteSnapshot {
    const room = NOTE_TITLE_MAX_CODE_POINTS - Array.from(COPY_SUFFIX).length
    const title = `${Array.from(normalizeNoteTitle(snapshot.title)).slice(0, room).join('')}${COPY_SUFFIX}`
    return {
        title,
        context: snapshot.context,
        content: isNoteDocument(snapshot.content) ? reissueAllBlockIds(snapshot.content, generateId) : snapshot.content,
    }
}
