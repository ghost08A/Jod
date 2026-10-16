import { useCallback, useEffect, useState } from 'react'
import { usePrototypeNotes } from '../hooks/usePrototypeNotes'
import '../prototype.css'
import type { SlashConfig } from './NoteCanvas'
import { PrototypeSwitcher } from './PrototypeSwitcher'
import { Workspace, type LayoutConfig } from './Workspace'

// PROTOTYPE (ticket 021): the "/" menu on the 017 layout C. Switch with ?variant=A|B|C or the bar / arrow keys
// (arrow keys only when you are not typing). State is in memory only.
// Question: how should the "/" menu look and feel, how do /reference and /note behave, on desktop and phone width?
const LAYOUT_C: LayoutConfig = { sidebarWidth: 300, contentMaxWidth: 600, titleSize: 52, topSpace: 140, align: 'start' }

const VARIANTS: Array<{ key: string, name: string, slash: SlashConfig }> = [
    { key: 'A', name: 'Floating · grouped · /note สร้างทันที', slash: { menuStyle: 'grouped', noteFlow: 'now' } },
    { key: 'B', name: 'Floating · flat · /note ตั้งชื่อก่อน (ข้อเสนอ)', slash: { menuStyle: 'flat', noteFlow: 'nameFirst' } },
    { key: 'C', name: 'Bottom panel · /note สร้างทันที', slash: { menuStyle: 'panel', noteFlow: 'now' } },
]

function readVariant(): string {
    const value = new URLSearchParams(window.location.search).get('variant') ?? 'A'
    return VARIANTS.some((item) => item.key === value) ? value : 'A'
}

export function PrototypeCaptureHome() {
    const [variant, setVariant] = useState(readVariant)
    const api = usePrototypeNotes()
    const { notice, dismissNotice } = api
    const current = VARIANTS.find((item) => item.key === variant) ?? VARIANTS[0]

    const changeVariant = useCallback((key: string) => {
        const url = new URL(window.location.href)
        url.searchParams.set('variant', key)
        window.history.replaceState(null, '', url)
        setVariant(key)
    }, [])

    useEffect(() => {
        if (!notice) return
        const timer = window.setTimeout(dismissNotice, 5000)
        return () => window.clearTimeout(timer)
    }, [notice, dismissNotice])

    return (
        <div className="pc-root">
            <Workspace api={api} layout={LAYOUT_C} slash={current.slash} />
            {notice && <div className="pc-toast" role="status">{notice}</div>}
            <PrototypeSwitcher
                variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
                current={variant}
                onChange={changeVariant}
            />
        </div>
    )
}
