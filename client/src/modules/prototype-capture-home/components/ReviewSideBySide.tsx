import type { ReviewRow } from '../types/review-block'
import { ReviewBlockView } from './ReviewBlockView'

interface ReviewSideBySideProps {
    rows: ReviewRow[]
    leftLabel: string
    rightLabel: string
}

// Note: Variant A - two aligned columns; changed rows get a soft tint, no lines between rows
export function ReviewSideBySide({ rows, leftLabel, rightLabel }: ReviewSideBySideProps) {
    return (
        <div className="pc-rv-sbs">
            <div className="pc-rv-colhead">{leftLabel}</div>
            <div className="pc-rv-colhead">{rightLabel}</div>
            {rows.map((row) => {
                const leftDiff = row.change === 'edited' && row.right ? { text: row.right.text, side: 'left' as const } : undefined
                const rightDiff = row.change === 'edited' && row.left ? { text: row.left.text, side: 'right' as const } : undefined
                return (
                    <div key={row.id} className={`pc-rv-sbs-row is-${row.change}`}>
                        <div className={`pc-rv-cell ${row.change === 'removed' ? 'is-removed' : ''}`}>
                            {row.left && <ReviewBlockView block={row.left} diffAgainst={leftDiff} />}
                        </div>
                        <div className={`pc-rv-cell ${row.change === 'added' ? 'is-added' : ''}`}>
                            {row.right && <ReviewBlockView block={row.right} diffAgainst={rightDiff} />}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
