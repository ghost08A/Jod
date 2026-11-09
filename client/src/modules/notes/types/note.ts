export type Note = {
    id: string
    title: string
    context: string
    /** The block document. Its shape is checked by the server; the editor ticket gives it a type */
    content: unknown
    version: number
    createdAt: string
    updatedAt: string
}

export type NoteListItem = {
    id: string
    title: string
    updatedAt: string
}
