/** The address of one note in the app */
export function buildNotePath(noteId: string): string {
    return `/notes/${encodeURIComponent(noteId)}`
}
