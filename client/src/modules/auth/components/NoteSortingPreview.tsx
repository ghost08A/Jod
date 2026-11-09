import type { CSSProperties } from 'react'

const SORTED_NOTES = [
    { group: 'งาน', note: 'ส่งสไลด์ให้พี่เมย์ก่อนเที่ยง', color: 'var(--color-sticker-orange)' },
    { group: 'ของที่ต้องซื้อ', note: 'นม ไข่ ผักบุ้ง', color: 'var(--color-sticker-green)' },
    { group: 'ไอเดีย', note: 'ลองทำแอปจดเสียงตอนขับรถ', color: 'var(--color-sticker-purple)' },
]

// Note: a picture of the idea (jot it down, AI files it), not real data; screen readers skip it
export function NoteSortingPreview() {
    return (
        <div className="sorting-preview" aria-hidden="true">
            <div className="sorting-capture">
                <span>ส่งสไลด์ให้พี่เมย์ก่อนเที่ยง</span>
                <span className="sorting-caret" />
            </div>

            <div className="sorting-link">
                <span className="sorting-link-label">AI จัดให้</span>
            </div>

            <ul className="sorting-groups">
                {SORTED_NOTES.map(({ group, note, color }, index) => (
                    <li key={group} className="sorting-row" style={{ '--row-index': index } as CSSProperties}>
                        <span className="sorting-dot" style={{ background: color }} />
                        <span className="sorting-group">{group}</span>
                        <span className="sorting-note">{note}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
