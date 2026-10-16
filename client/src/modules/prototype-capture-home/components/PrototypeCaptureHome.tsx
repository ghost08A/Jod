import { useCallback, useEffect, useState } from 'react'
import { usePrototypeNotes } from '../hooks/usePrototypeNotes'
import '../prototype.css'
import { PrototypeSwitcher } from './PrototypeSwitcher'
import { Workspace, type LayoutConfig } from './Workspace'

// PROTOTYPE (ticket 017): three workspace layouts, switch with ?variant=A|B|C or the bar / arrow keys.
// Question: does Jod feel like a calm writing canvas with a navigation tree? State is in memory only.
const LAYOUTS: Array<{ key: string, name: string, layout: LayoutConfig }> = [
    { key: 'A', name: 'Classic · side 260 / text 720', layout: { sidebarWidth: 260, contentMaxWidth: 720, titleSize: 40, topSpace: 96, align: 'center' } },
    { key: 'B', name: 'Wide · side 220 / text 960', layout: { sidebarWidth: 220, contentMaxWidth: 960, titleSize: 30, topSpace: 48, align: 'center' } },
    { key: 'C', name: 'Focus · side 300 / text 600 left', layout: { sidebarWidth: 300, contentMaxWidth: 600, titleSize: 52, topSpace: 140, align: 'start' } },
]

function readVariant(): string {
    const value = new URLSearchParams(window.location.search).get('variant') ?? 'A'
    return LAYOUTS.some((item) => item.key === value) ? value : 'A'
}

export function PrototypeCaptureHome() {
    const [variant, setVariant] = useState(readVariant)
    const api = usePrototypeNotes()
    const { notice, dismissNotice } = api
    const current = LAYOUTS.find((item) => item.key === variant) ?? LAYOUTS[0]

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

    return (
        <div className="pc-root">
            <Workspace api={api} layout={current.layout} />
            {notice && <div className="pc-toast" role="status">{notice}</div>}
            <PrototypeSwitcher
                variants={LAYOUTS.map(({ key, name }) => ({ key, name }))}
                current={variant}
                onChange={changeVariant}
            />
        </div>
    )
}
