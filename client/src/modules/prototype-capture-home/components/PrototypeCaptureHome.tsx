import { useCallback, useEffect, useState } from 'react'
import { usePrototypeNotes } from '../hooks/usePrototypeNotes'
import '../prototype.css'
import { PrototypeSwitcher } from './PrototypeSwitcher'
import { VariantA } from './VariantA'
import { VariantB } from './VariantB'
import { VariantC } from './VariantC'

// PROTOTYPE (ticket 017): three variants of home + capture, switch with ?variant=A|B|C or the bar / arrow keys.
// Question: how should "จดก่อน จัดทีหลัง" feel on the home page? State is in memory only.
const VARIANTS = [
    { key: 'A', name: 'Sidebar + Save bar' },
    { key: 'B', name: 'Inbox-first + sheet' },
    { key: 'C', name: 'Tabs + split Save' },
]

function readVariant(): string {
    const value = new URLSearchParams(window.location.search).get('variant') ?? 'A'
    return VARIANTS.some((variant) => variant.key === value) ? value : 'A'
}

export function PrototypeCaptureHome() {
    const [variant, setVariant] = useState(readVariant)
    const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
    const api = usePrototypeNotes()
    const { notice, dismissNotice } = api

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
        <div className={`pc-root ${dark ? 'is-dark' : ''}`}>
            {variant === 'A' && <VariantA api={api} />}
            {variant === 'B' && <VariantB api={api} />}
            {variant === 'C' && <VariantC api={api} />}
            {notice && <div className="pc-toast" role="status">{notice}</div>}
            <button type="button" className="pc-theme" onClick={() => setDark(!dark)} aria-label="สลับธีมมืด/สว่าง">{dark ? '☀' : '☾'}</button>
            <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={changeVariant} />
        </div>
    )
}
