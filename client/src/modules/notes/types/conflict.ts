export type ConflictSide = 'mine' | 'theirs'

/** The answer of a copy to the clipboard: the browser either did it or refused */
export type CopyResult = 'copied' | 'refused'

/** The copy result of one side of the conflict page */
export type ConflictCopyResult = { side: ConflictSide; result: CopyResult }
