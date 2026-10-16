import { useMemo, useState } from 'react'
import { REVIEW_ITEMS } from '../constants/review-groups'
import type { Pick, ReviewChoice, Selection } from '../types/review-block'
import { PROTECTED_KINDS } from '../types/review-block'
import { buildPreview, bulkSelection, summarize } from '../utils/review-selection'
import { ReviewBlockView } from './ReviewBlockView'
import { ReviewGroupRow } from './ReviewGroupRow'
import { ReviewPreview } from './ReviewPreview'

interface BlockReviewScreenProps {
    noteTitle: string
    onResolve: (choice: ReviewChoice) => void
    onToggleSidebar: () => void
}

// Note: Variant A, block-by-block. Nothing is applied until Confirm; "all" buttons only set the choices.
export function BlockReviewScreen({ noteTitle, onResolve, onToggleSidebar }: BlockReviewScreenProps) {
    const [selection, setSelection] = useState<Selection>(() => bulkSelection(REVIEW_ITEMS, 'original'))
    const [view, setView] = useState<'compare' | 'preview'>('compare')
    const summary = summarize(REVIEW_ITEMS, selection)
    const preview = useMemo(() => buildPreview(REVIEW_ITEMS, selection), [selection])

    function pick(groupId: string, value: Pick) {
        setSelection((current) => ({ ...current, [groupId]: value }))
    }

    function flip(groupId: string) {
        pick(groupId, selection[groupId] === 'ai' ? 'original' : 'ai')
    }

    return (
        <div className="pc-canvas">
            <header className="pc-topbar">
                <button type="button" className="pc-quiet pc-toggle" onClick={onToggleSidebar} aria-label="ซ่อน/แสดงแถบข้าง">☰</button>
                <span className="pc-path">AI เสนอฉบับใหม่ · {noteTitle}</span>
                <button type="button" className="pc-quiet" onClick={() => onResolve('discard')}>ทิ้งทั้งหมด</button>
                <button
                    type="button"
                    className="pc-quiet pc-rv-primary"
                    disabled={summary.ai === 0}
                    title={summary.ai === 0 ? 'ยังไม่ได้เลือกฉบับ AI ส่วนไหนเลย' : undefined}
                    onClick={() => onResolve('apply')}
                >
                    ยืนยันใช้ผลลัพธ์นี้
                </button>
            </header>
            <div className="pc-br-toolbar">
                <span className="pc-br-count">
                    {summary.total} การเปลี่ยนแปลง · <strong>{summary.ai} ใช้ฉบับ AI</strong> · {summary.original} เก็บฉบับเดิม
                </span>
                <button type="button" className="pc-quiet" onClick={() => setSelection(bulkSelection(REVIEW_ITEMS, 'ai'))}>ใช้ฉบับ AI ทั้งหมด</button>
                <button type="button" className="pc-quiet" onClick={() => setSelection(bulkSelection(REVIEW_ITEMS, 'original'))}>เก็บฉบับเดิมทั้งหมด</button>
                <div className="pc-rv-seg" role="group" aria-label="โหมดดู">
                    <button type="button" className={view === 'compare' ? 'is-on' : ''} onClick={() => setView('compare')}>เทียบทีละส่วน</button>
                    <button type="button" className={view === 'preview' ? 'is-on' : ''} onClick={() => setView('preview')}>ดูผลลัพธ์</button>
                </div>
            </div>
            <p className="pc-rv-note">
                ✓ ผ่านการตรวจแล้ว: Block ที่ห้ามแตะครบ {summary.protectedUnchanged} จาก {summary.protectedUnchanged} และไม่ถูกแก้
                · ฉบับเดิมยังไม่ถูกแก้จนกว่าจะกดยืนยัน
            </p>
            {view === 'compare' ? (
                <div className="pc-br-body">
                    <div className="pc-br-heads"><span>ฉบับเดิม</span><span>ฉบับที่ AI เสนอ</span></div>
                    {REVIEW_ITEMS.map((item) => item.kind === 'context' ? (
                        <div key={item.id} className="pc-br-ctx">
                            <ReviewBlockView block={item.block} />
                            <ReviewBlockView block={item.block} />
                            {PROTECTED_KINDS.includes(item.block.kind) && <span className="pc-br-same">✓ ไม่เปลี่ยน</span>}
                        </div>
                    ) : (
                        <ReviewGroupRow
                            key={item.group.id}
                            group={item.group}
                            picked={selection[item.group.id]}
                            onPick={(value) => pick(item.group.id, value)}
                        />
                    ))}
                </div>
            ) : (
                <ReviewPreview rows={preview} selection={selection} onFlip={flip} />
            )}
        </div>
    )
}
