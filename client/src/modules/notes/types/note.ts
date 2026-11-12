export type NotePlacement = 'unplaced' | 'root' | 'child'

export type Note = {
    id: string
    title: string
    context: string
    /** The block document. Its shape is checked by the server; the editor ticket gives it a type */
    content: unknown
    version: number
    createdAt: string
    updatedAt: string
    placement: NotePlacement
    /** Only a child has a parent */
    parentId: string | null
    /** Order among siblings */
    position: number
}

export type NoteListItem = {
    id: string
    title: string
    updatedAt: string
    placement: NotePlacement
    parentId: string | null
    position: number
}

/** One note of the sidebar tree with everything that hangs under it */
export type NoteBranch = {
    item: NoteListItem
    children: NoteBranch[]
}

/** Body of the placement call. `beforeId` puts the note right before that sibling; without it the note goes last */
export type PlacementRequest = {
    placement: NotePlacement
    parentId?: string
    beforeId?: string
}
