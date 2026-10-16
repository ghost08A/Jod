import type { ReviewRow } from '../types/review-block'
import { ReviewBlockView } from './ReviewBlockView'

interface ReviewPeekProps {
    rows: ReviewRow[]
    side: 'left' | 'right'
}

// Note: Variant C - looks like the normal page; a dot in the gutter marks what differs, the toggle lives in the top bar
export function ReviewPeek({ rows, side }: ReviewPeekProps) {
    return (
        <div className="pc-rv-peek">
            {rows.map((row) => {
                const block = side === 'right' ? row.right : row.left
                if (!block) return null
                const marked = row.change !== 'same'
                return (
                    <div key={row.id} className="pc-rv-peek-row">
                        <span className={`pc-rv-dot ${marked ? `is-${row.change}` : ''}`} aria-hidden="true" />
                        <ReviewBlockView block={block} />
                    </div>
                )
            })}
        </div>
    )
}
