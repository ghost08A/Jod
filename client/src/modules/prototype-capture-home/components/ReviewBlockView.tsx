import type { ReactNode } from 'react'
import { diffWords } from '../utils/word-diff'
import { PROTECTED_KINDS, type ReviewBlock } from '../types/review-block'

interface ReviewBlockViewProps {
    block: ReviewBlock
    // Note: when set, show a word diff against this text instead of the plain block text
    diffAgainst?: { text: string, side: 'left' | 'right' }
}

function renderText(block: ReviewBlock, diffAgainst: ReviewBlockViewProps['diffAgainst']): ReactNode {
    if (!diffAgainst) return block.text
    const parts = diffAgainst.side === 'right'
        ? diffWords(diffAgainst.text, block.text)
        : diffWords(block.text, diffAgainst.text)
    const hidden = diffAgainst.side === 'right' ? 'del' : 'add'
    return parts
        .filter((part) => part.kind !== hidden)
        .map((part, index) => (
            <span key={index} className={part.kind === 'same' ? undefined : `pc-rv-${part.kind}`}>{part.text}</span>
        ))
}

export function ReviewBlockView({ block, diffAgainst }: ReviewBlockViewProps) {
    const content = renderText(block, diffAgainst)
    const locked = PROTECTED_KINDS.includes(block.kind)
    return (
        <div className={`pc-rv-block is-${block.kind}`}>
            {block.kind === 'bullet' && <span className="pc-rv-mark">•</span>}
            {block.kind === 'checklist' && <span className="pc-rv-mark">☐</span>}
            {block.kind === 'reference' && <span className="pc-rv-mark">↗</span>}
            {block.kind === 'file' && <span className="pc-rv-mark">📎</span>}
            <span className="pc-rv-text">{content}</span>
            {locked && <span className="pc-rv-lock" title="AI ไม่แตะ Block นี้">🔒</span>}
        </div>
    )
}
