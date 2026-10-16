import { useCallback, useEffect, useState } from 'react'
import { usePrototypeNotes } from '../hooks/usePrototypeNotes'
import '../prototype.css'
import type { ReviewChoice, ScenarioKind } from '../types/review-block'
import { CONFLICT_ROWS } from '../constants/review-samples'
import { PrototypeSwitcher } from './PrototypeSwitcher'
import { Workspace } from './Workspace'

// PROTOTYPE (ticket 018): three ways to present "AI proposal" and "save conflict" review screens on the 017 layout C.
// Switch with ?variant=A|B|C or the bar / arrow keys. Scenarios are triggered from the bottom-left bar. Nothing is persisted.
const VARIANTS = [
    { key: 'A', name: 'Side-by-side' },
    { key: 'B', name: 'Inline diff' },
    { key: 'C', name: 'Peek toggle' },
]

const SCENARIOS: Array<{ kind: ScenarioKind, label: string }> = [
    { kind: 'format', label: 'AI จัดโครงสร้าง' },
    { kind: 'formatFail', label: 'AI ตรวจไม่ผ่าน' },
    { kind: 'conflict', label: 'บันทึกชนกัน' },
]

const MESSAGES: Record<ReviewChoice, string> = {
    apply: 'ใช้ฉบับที่ AI จัดแล้ว (ย้อนกลับได้)',
    discard: 'ปิดแล้ว ฉบับเดิมไม่เปลี่ยน',
    retry: 'ลองใหม่ (จำลอง)',
    thisTab: 'ใช้ฉบับนี้แล้ว',
    otherTab: 'ใช้ฉบับอีกแท็บแล้ว',
    both: 'เก็บทั้งสองแล้ว: ฉบับอีกแท็บอยู่ใน "รอจัดวาง"',
}

function readVariant(): string {
    const value = new URLSearchParams(window.location.search).get('variant') ?? 'A'
    return VARIANTS.some((item) => item.key === value) ? value : 'A'
}

export function PrototypeCaptureHome() {
    const [variant, setVariant] = useState(readVariant)
    const [scenario, setScenario] = useState<ScenarioKind | undefined>()
    const [message, setMessage] = useState<string | undefined>()
    const api = usePrototypeNotes()
    const { notice, dismissNotice, addNote } = api

    const changeVariant = useCallback((key: string) => {
        const url = new URL(window.location.href)
        url.searchParams.set('variant', key)
        window.history.replaceState(null, '', url)
        setVariant(key)
    }, [])

    useEffect(() => {
        if (!notice) return
        const timer = window.setTimeout(dismissNotice, 4000)
        return () => window.clearTimeout(timer)
    }, [notice, dismissNotice])

    useEffect(() => {
        if (!message) return
        const timer = window.setTimeout(() => setMessage(undefined), 5000)
        return () => window.clearTimeout(timer)
    }, [message])

    function resolve(choice: ReviewChoice, noteTitle: string) {
        if (choice === 'retry') {
            setScenario('format')
            return
        }
        if (choice === 'both') {
            const body = CONFLICT_ROWS.map((row) => row.right?.text).filter(Boolean).join('\n')
            addNote(`${noteTitle} (ฉบับอีกแท็บ)`, body)
        }
        setScenario(undefined)
        setMessage(MESSAGES[choice])
    }

    return (
        <div className="pc-root">
            <Workspace
                api={api}
                scenario={scenario}
                reviewVariant={variant}
                onStartFormat={() => setScenario('format')}
                onResolve={resolve}
            />
            {(message ?? notice) && <div className="pc-toast" role="status">{message ?? notice}</div>}
            <div className="pc-scenarios" role="group" aria-label="จำลองสถานการณ์">
                {SCENARIOS.map((item) => (
                    <button key={item.kind} type="button" onClick={() => setScenario(item.kind)}>{item.label}</button>
                ))}
            </div>
            <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={changeVariant} />
        </div>
    )
}
