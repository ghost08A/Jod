import type { ChangeGroup, Pick, ReviewBlock } from '../types/review-block'
import { GroupControlBar } from './GroupControlBar'
import { ReviewBlockView } from './ReviewBlockView'

interface ReviewGroupRowProps {
    group: ChangeGroup
    picked: Pick
    onPick: (pick: Pick) => void
}

function Cell({ blocks, empty, picked, side, diffAgainst }: {
    blocks: ReviewBlock[]
    empty: string
    picked: boolean
    side: 'left' | 'right'
    diffAgainst?: { text: string, side: 'left' | 'right' }
}) {
    return (
        <div className={`pc-gr-cell is-${side} ${picked ? 'is-picked' : 'is-dim'}`}>
            {blocks.length === 0 && <p className="pc-gr-empty">{empty}</p>}
            {blocks.map((block, index) => <ReviewBlockView key={index} block={block} diffAgainst={diffAgainst} />)}
        </div>
    )
}

export function ReviewGroupRow({ group, picked, onPick }: ReviewGroupRowProps) {
    const single = group.type === 'edit' && group.left.length === 1 && group.right.length === 1
    return (
        <section className={`pc-gr is-${group.type}`}>
            <GroupControlBar group={group} picked={picked} onPick={onPick} />
            <div className="pc-gr-cols">
                <Cell
                    blocks={group.left}
                    empty="ฉบับเดิมไม่มี Block นี้"
                    picked={picked === 'original'}
                    side="left"
                    diffAgainst={single ? { text: group.right[0].text, side: 'left' } : undefined}
                />
                <Cell
                    blocks={group.right}
                    empty="AI เสนอให้นำ Block นี้ออก"
                    picked={picked === 'ai'}
                    side="right"
                    diffAgainst={single ? { text: group.left[0].text, side: 'right' } : undefined}
                />
            </div>
        </section>
    )
}
