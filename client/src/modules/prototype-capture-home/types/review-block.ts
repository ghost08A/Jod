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
