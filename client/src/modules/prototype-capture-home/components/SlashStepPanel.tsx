import { useState } from 'react'
import type { PrototypeNote } from '../types/prototype-note'
import type { SlashStep } from '../hooks/useSlashMenu'
import { bodyPreview, displayTitle, isEmptyDraft, notePath } from '../utils/note-label'

interface SlashStepPanelProps {
    step: SlashStep
    notes: PrototypeNote[]
    current: PrototypeNote
    onCancel: () => void
    onReference: (note: PrototypeNote) => void
    onLink: (url: string) => void
    onName: (name: string) => void
}

const HINT = {
    reference: 'การ์ดจะชี้ไปหา Note นั้น Note ที่เลือกไม่ถูกย้ายหรือเปลี่ยนที่วาง',
    link: 'ลิงก์ใช้กับเว็บภายนอกเท่านั้น ถ้าจะเชื่อมไป Note ใน Jod ใช้ "การ์ดไปหา Note" หรือ "สร้าง Note ลูก"',
    name: 'ตั้งชื่อก่อนสร้าง เว้นว่างได้ จะใช้ชื่อ Untitled',
} as const

export function SlashStepPanel({ step, notes, current, onCancel, onReference, onLink, onName }: SlashStepPanelProps) {
    const [text, setText] = useState('')
    const [active, setActive] = useState(0)
    const [error, setError] = useState<string | undefined>()
    const needle = text.trim().toLowerCase()
    const results = step === 'reference'
        ? notes.filter((note) => note.id !== current.id && !isEmptyDraft(note)
            && (needle === '' || displayTitle(note).toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle)))
        : []

    function submit() {
        if (step === 'reference') {
            const chosen = results[active]
            if (chosen) onReference(chosen)
        } else if (step === 'link') {
            if (/^https?:\/\/\S+/.test(text.trim())) onLink(text.trim())
            else setError('ใส่ลิงก์เว็บที่ขึ้นต้นด้วย https://')
        } else {
            onName(text.trim())
        }
    }

    return (
        <div className="pc-ss" role="dialog" aria-label="ขั้นตอนต่อไป">
            <input
                className="pc-ss-input"
                autoFocus
                value={text}
                placeholder={step === 'reference' ? 'ค้นหา Note…' : step === 'link' ? 'วาง URL เช่น https://…' : 'Untitled'}
                onChange={(event) => { setText(event.target.value); setActive(0); setError(undefined) }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') onCancel()
                    else if (event.key === 'Enter') { event.preventDefault(); submit() }
                    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(active + 1, results.length - 1)) }
                    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(active - 1, 0)) }
                }}
            />
            <p className="pc-ss-hint">{error ?? HINT[step]}</p>
            {step === 'reference' && (
                <div className="pc-ss-list">
                    {results.length === 0 && <p className="pc-sm-empty">ไม่พบ Note</p>}
                    {results.map((note, index) => (
                        <button
                            key={note.id}
                            type="button"
                            className={`pc-ss-row ${index === active ? 'is-active' : ''}`}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => onReference(note)}
                        >
                            <strong>{displayTitle(note)}</strong>
                            <span className="pc-sm-desc">{note.placement === 'unplaced' ? 'รอจัดวาง' : notePath(notes, note)}{note.body && ` · ${bodyPreview(note)}`}</span>
                        </button>
                    ))}
                </div>
            )}
            {step === 'name' && <p className="pc-ss-hint">จะสร้างไว้ใต้ "{displayTitle(current)}" กด Enter เพื่อสร้าง Esc เพื่อยกเลิก</p>}
        </div>
    )
}
