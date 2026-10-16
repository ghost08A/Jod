// Note: PROTOTYPE (ticket 018) - fake blocks just to judge the review screens
export type ReviewBlockKind =
    | 'paragraph' | 'heading' | 'bullet' | 'checklist'
    | 'code' | 'reference' | 'file' | 'link'

export interface ReviewBlock {
    kind: ReviewBlockKind
    text: string
}

export type RowChange = 'same' | 'added' | 'edited' | 'removed'

// Note: left = original / this tab, right = AI proposal / other tab
export interface ReviewRow {
    id: string
    change: RowChange
    left?: ReviewBlock
    right?: ReviewBlock
}

export type ScenarioKind = 'format' | 'formatFail' | 'conflict'

export type ReviewChoice = 'apply' | 'discard' | 'retry' | 'thisTab' | 'otherTab' | 'both'

export const PROTECTED_KINDS: ReviewBlockKind[] = ['code', 'reference', 'file', 'link']

// ticket 018 (block-by-block review)
export type ChangeType = 'edit' | 'add' | 'remove' | 'split' | 'merge' | 'move'

export interface ChangeGroup {
    id: string
    type: ChangeType
    left: ReviewBlock[]
    right: ReviewBlock[]
    relation?: string
    movesToEnd?: boolean
}

export type ReviewItem =
    | { kind: 'context', id: string, block: ReviewBlock }
    | { kind: 'change', group: ChangeGroup }

export type Pick = 'original' | 'ai'
export type Selection = Record<string, Pick>

export interface PreviewRow {
    id: string
    block?: ReviewBlock
    ghost?: string
    groupId?: string
    fromAi: boolean
}
