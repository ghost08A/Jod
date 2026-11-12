import { getJson, requestJson } from '../../../core/http/http-client'
import type { DeleteScope, Note, NoteListItem, PlacementRequest, TrashNoteItem } from '../types/note'

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

/** Moves the note (with its whole branch) and sets its order. Does not touch the content version */
export function placeNote(noteId: string, request: PlacementRequest): Promise<NoteListItem> {
    return requestJson<NoteListItem>(`/api/notes/${encodeURIComponent(noteId)}/placement`, { method: 'PUT', body: request })
}

/** Sends the note to Trash. Answers how many notes went (the note itself, plus its branch when the scope is `branch`) */
export function deleteNote(noteId: string, scope: DeleteScope): Promise<{ deletedCount: number }> {
    return requestJson<{ deletedCount: number }>(`/api/notes/${encodeURIComponent(noteId)}?scope=${scope}`, { method: 'DELETE' })
}

/** Every deleted note of the user, flat */
export function listTrash(): Promise<TrashNoteItem[]> {
    return getJson<TrashNoteItem[]>('/api/notes/trash')
}

/** Asks the server to remove an untouched new note for good (not Trash). The server decides; `discarded: false` means it was kept */
export function discardEmptyNote(noteId: string, baseVersion: number): Promise<{ discarded: boolean }> {
    return requestJson<{ discarded: boolean }>(`/api/notes/${encodeURIComponent(noteId)}/discard-empty`, { method: 'POST', body: { baseVersion } })
}
