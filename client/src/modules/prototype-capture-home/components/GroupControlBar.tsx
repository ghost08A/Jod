import type { ChangeGroup, Pick } from '../types/review-block'

interface GroupControlBarProps {
    group: ChangeGroup
    picked: Pick
    onPick: (pick: Pick) => void
}

const TYPE_LABEL = {
    edit: 'แก้ไข', add: 'เพิ่มใหม่', remove: 'นำออก',
    split: 'แตกเป็นหลายส่วน', merge: 'รวมเป็นส่วนเดียว', move: 'ย้ายตำแหน่ง',
} as const

const BUTTON_LABEL = {
    add: { original: 'ไม่รับ', ai: 'รับ Block นี้' },
    remove: { original: 'เก็บ Block เดิม', ai: 'ยอมรับให้นำออก' },
    other: { original: '← ใช้ฉบับเดิม', ai: 'ใช้ฉบับ AI →' },
} as const

const STATUS_LABEL = {
    add: { original: 'ไม่รับ', ai: 'รับ' },
    remove: { original: 'เก็บไว้', ai: 'นำออก' },
    other: { original: 'ฉบับเดิม', ai: 'ฉบับ AI' },
} as const

// Note: the strip above each changed block; the picked side stays highlighted so the choice is always visible
export function GroupControlBar({ group, picked, onPick }: GroupControlBarProps) {
    const set = group.type === 'add' || group.type === 'remove' ? group.type : 'other'
    return (
        <div className="pc-gc-bar">
            <span className={`pc-gc-type is-${group.type}`}>{TYPE_LABEL[group.type]}</span>
            {group.relation && <span className="pc-gc-relation">{group.relation}</span>}
            <span className="pc-gc-status">เลือก: {STATUS_LABEL[set][picked]}</span>
            <div className="pc-gc-seg" role="group" aria-label="เลือกฉบับของ Block นี้">
                <button type="button" className={picked === 'original' ? 'is-on' : ''} onClick={() => onPick('original')}>
                    {BUTTON_LABEL[set].original}
                </button>
                <button
                    type="button"
                    className={picked === 'ai' ? 'is-on' : ''}
                    onClick={() => onPick('ai')}
                >
                    {BUTTON_LABEL[set].ai}
                </button>
            </div>
        </div>
    )
}
