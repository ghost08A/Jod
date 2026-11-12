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
    /** When the note went to Trash; null for a note that is not deleted */
    deletedAt: string | null
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

/** What a delete takes: the note with its whole branch, or only the note (its children move up) */
export type DeleteScope = 'branch' | 'single'

/** One deleted note. placement, parentId and position are the values at the moment of deletion */
export type TrashNoteItem = {
    id: string
    title: string
    deletedAt: string
    trashBatchId: string
    placement: NotePlacement
    parentId: string | null
    position: number
}

/** One deleted note of the Trash tree with the deleted notes that hang under it */
export type TrashBranch = {
    item: TrashNoteItem
    children: TrashBranch[]
}

export type NoteSearchResult = {
    id: string
    title: string
    updatedAt: string
    /** Ancestor titles, top-down; empty for a top-level note */
    path: { id: string; title: string }[]
    /** About 100 characters of the note text around the first match; may hold line breaks */
    snippet: string
}

export type NoteSearchPage = {
    items: NoteSearchResult[]
    hasMore: boolean
}
