import { getJson, requestJson } from '../../../core/http/http-client'
import type { Note, NoteListItem } from '../types/note'

/** Creates an empty note ("Untitled") for the signed-in user */
export function createNote(): Promise<Note> {
    return requestJson<Note>('/api/notes', { method: 'POST' })
}

/** The server already sorts the list, newest change first */
export function listNotes(): Promise<NoteListItem[]> {
    return getJson<NoteListItem[]>('/api/notes')
}

export function getNote(noteId: string): Promise<Note> {
    return getJson<Note>(`/api/notes/${encodeURIComponent(noteId)}`)
}
