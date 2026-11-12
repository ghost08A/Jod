import { getJson, requestJson } from '../../../core/http/http-client'
import type { Note, NoteListItem } from '../types/note'

/** Creates an empty note ("Untitled"): a child placed last under `parentId`, or an unplaced note without it */
export function createNote(options: { parentId?: string } = {}): Promise<Note> {
    const body = options.parentId === undefined ? undefined : { parentId: options.parentId }
    return requestJson<Note>('/api/notes', { method: 'POST', body })
}

/** The server already sorts the list, newest change first */
export function listNotes(): Promise<NoteListItem[]> {
    return getJson<NoteListItem[]>('/api/notes')
}

export function getNote(noteId: string): Promise<Note> {
    return getJson<Note>(`/api/notes/${encodeURIComponent(noteId)}`)
}

/** Saves the whole note. A baseVersion other than the stored one is answered with 409 and the current note */
export function saveNote(
    noteId: string,
    body: Pick<Note, 'title' | 'context' | 'content'> & { baseVersion: number },
    keepalive = false,
): Promise<Note> {
    return requestJson<Note>(`/api/notes/${encodeURIComponent(noteId)}`, { method: 'PUT', body, keepalive })
}
