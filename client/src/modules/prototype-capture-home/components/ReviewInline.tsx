import { CHANGE_LABEL } from '../constants/review-samples'
import type { ReviewRow } from '../types/review-block'
import { ReviewBlockView } from './ReviewBlockView'

interface ReviewInlineProps {
    rows: ReviewRow[]
    scenario: 'format' | 'conflict'
}

// Note: Variant B - one document column; additions and removals shown in place, labels in the margin
export function ReviewInline({ rows, scenario }: ReviewInlineProps) {
    return (
        <div className="pc-rv-inline">
            {rows.map((row) => {
                const label = CHANGE_LABEL[scenario][row.change]
                const edited = row.change === 'edited' && row.left && row.right
                return (
                    <div key={row.id} className={`pc-rv-inline-row is-${row.change}`}>
                        <span className="pc-rv-margin">{label}</span>
                        {edited && row.right && row.left && (
                            <ReviewBlockView block={row.right} diffAgainst={{ text: row.left.text, side: 'right' }} />
                        )}
                        {!edited && row.change === 'removed' && row.left && (
                            <div className="is-struck"><ReviewBlockView block={row.left} /></div>
                        )}
                        {!edited && row.change !== 'removed' && (row.right ?? row.left) && (
                            <ReviewBlockView block={(row.right ?? row.left)!} />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
