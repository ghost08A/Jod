import type { PreviewRow, Selection } from '../types/review-block'
import { ReviewBlockView } from './ReviewBlockView'

interface ReviewPreviewProps {
    rows: PreviewRow[]
    selection: Selection
    onFlip: (groupId: string) => void
}

// Note: shows the note as it will really be after Confirm; every changed block can still be flipped back here
export function ReviewPreview({ rows, selection, onFlip }: ReviewPreviewProps) {
    return (
        <div className="pc-pv">
            <p className="pc-rv-note">นี่คือ Note ที่จะได้ถ้ากดยืนยันตอนนี้ ฉบับเดิมยังไม่ถูกแก้</p>
            {rows.map((row) => {
                const groupId = row.groupId
                const flipLabel = groupId && selection[groupId] === 'ai' ? 'เปลี่ยนกลับเป็นฉบับเดิม' : 'ใช้ฉบับ AI แทน'
                return (
                    <div key={row.id} className={`pc-pv-row ${row.ghost ? 'is-ghost' : ''}`}>
                        <span className={`pc-pv-dot ${row.fromAi ? 'is-ai' : ''}`} aria-hidden="true" />
                        {row.block && <ReviewBlockView block={row.block} />}
                        {row.ghost && <span className="pc-pv-ghost">({row.ghost})</span>}
                        {groupId && (
                            <button
                                type="button"
                                className="pc-pv-flip"
                                onClick={() => onFlip(groupId)}
                            >
                                {row.fromAi ? '✦ AI · ' : 'เดิม · '}{flipLabel}
                            </button>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
