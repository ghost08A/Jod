// Note: PROTOTYPE (ticket 017) - throwaway, in-memory only
export type Placement = 'root' | 'child' | 'unplaced'

export type SaveChoice = 'ai' | 'root' | 'unplaced'

export interface Suggestion {
    state: 'loading' | 'ready' | 'none'
    parentId?: string
}

export interface PrototypeNote {
    id: string
    title: string
    body: string
    placement: Placement
    parentId?: string
    suggestion?: Suggestion
    rejectedParentIds: string[]
    isDraft: boolean
}
