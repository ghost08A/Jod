import { useState } from 'react'
import { CONFLICT_ROWS, FORMAT_ROWS } from '../constants/review-samples'
import type { ReviewChoice, ScenarioKind } from '../types/review-block'
import { BlockReviewScreen } from './BlockReviewScreen'
import { ReviewInline } from './ReviewInline'
import { ReviewPeek } from './ReviewPeek'
import { ReviewSideBySide } from './ReviewSideBySide'

interface ReviewScreenProps {
    scenario: ScenarioKind
    variant: string
    noteTitle: string
    onResolve: (choice: ReviewChoice) => void
    onToggleSidebar: () => void
}

const ACTIONS: Record<ScenarioKind, Array<{ choice: ReviewChoice, label: string, primary?: boolean }>> = {
    format: [{ choice: 'apply', label: 'ใช้ฉบับที่ AI จัด', primary: true }, { choice: 'discard', label: 'ทิ้ง' }],
    formatFail: [{ choice: 'retry', label: 'ลองใหม่', primary: true }, { choice: 'discard', label: 'ปิด' }],
    conflict: [
        { choice: 'thisTab', label: 'ใช้ฉบับนี้' },
        { choice: 'otherTab', label: 'ใช้ฉบับอีกแท็บ' },
        { choice: 'both', label: 'เก็บทั้งสอง', primary: true },
    ],
}

export function ReviewScreen({ scenario, variant, noteTitle, onResolve, onToggleSidebar }: ReviewScreenProps) {
    const [peekSide, setPeekSide] = useState<'left' | 'right'>('right')
    const isConflict = scenario === 'conflict'
    const rows = isConflict ? CONFLICT_ROWS : FORMAT_ROWS
    const leftLabel = isConflict ? 'ฉบับนี้ (แท็บนี้)' : 'ฉบับเดิม'
    const rightLabel = isConflict ? 'ฉบับอีกแท็บ' : 'ฉบับที่ AI จัด'
    const headline = isConflict ? 'Note นี้ถูกแก้จากอีกแท็บ' : 'AI เสนอฉบับใหม่'

    if (scenario === 'format' && variant === 'A') {
        return <BlockReviewScreen noteTitle={noteTitle} onResolve={onResolve} onToggleSidebar={onToggleSidebar} />
    }

    return (
        <div className="pc-canvas">
            <header className="pc-topbar">
                <button type="button" className="pc-quiet pc-toggle" onClick={onToggleSidebar} aria-label="ซ่อน/แสดงแถบข้าง">☰</button>
                <span className="pc-path">{headline} · {noteTitle}</span>
                {variant === 'C' && scenario !== 'formatFail' && (
                    <div className="pc-rv-seg" role="group" aria-label="เลือกฉบับที่ดู">
                        <button type="button" className={peekSide === 'right' ? 'is-on' : ''} onClick={() => setPeekSide('right')}>{rightLabel}</button>
                        <button type="button" className={peekSide === 'left' ? 'is-on' : ''} onClick={() => setPeekSide('left')}>{leftLabel}</button>
                    </div>
                )}
                {ACTIONS[scenario].map((action) => (
                    <button
                        key={action.choice}
                        type="button"
                        className={`pc-quiet ${action.primary ? 'pc-rv-primary' : ''}`}
                        onClick={() => onResolve(action.choice)}
                    >
                        {action.label}
                    </button>
                ))}
            </header>
            {scenario === 'formatFail' ? (
                <div className="pc-rv-fail">
                    <p>ผลลัพธ์ของ AI ไม่ผ่านการตรวจ ระบบทิ้งผลลัพธ์ทั้งชุดแล้ว</p>
                    <p className="pc-rv-sub">AI พยายามเปลี่ยน Link (https://example.com/pricing) ซึ่งเป็น Block ที่ห้ามแตะ</p>
                    <p className="pc-rv-sub">ระบบไม่นำส่วนอื่นจากผลลัพธ์ชุดนี้มาใช้ต่อ เพราะอาจเกี่ยวข้องกัน ฉบับเดิมของคุณยังอยู่ครบ ไม่มีอะไรเปลี่ยน</p>
                </div>
            ) : (
                <>
                    <p className="pc-rv-note">
                        {isConflict
                            ? 'แท็บนี้บันทึกล่าสุด 10:42 · อีกแท็บ 10:44 · "เก็บทั้งสอง" = ฉบับอีกแท็บไปอยู่ใน รอจัดวาง'
                            : '✓ ตรวจแล้ว: Block ที่ห้ามแตะครบ 4 จาก 4 (การ์ด, Code, Link, ไฟล์) · ส่วนที่เปลี่ยนความหมายหรือไม่ ต้องตรวจเอง'}
                    </p>
                    {variant === 'A' && <ReviewSideBySide rows={rows} leftLabel={leftLabel} rightLabel={rightLabel} />}
                    {variant === 'B' && <ReviewInline rows={rows} scenario={isConflict ? 'conflict' : 'format'} />}
                    {variant === 'C' && <ReviewPeek rows={rows} side={peekSide} />}
                </>
            )}
        </div>
    )
}
