import { useEffect } from 'react'

interface PrototypeSwitcherProps {
    variants: Array<{ key: string, name: string }>
    current: string
    onChange: (key: string) => void
}

export function PrototypeSwitcher({ variants, current, onChange }: PrototypeSwitcherProps) {
    const index = Math.max(0, variants.findIndex((variant) => variant.key === current))

    useEffect(() => {
        function handleKey(event: KeyboardEvent) {
            const target = event.target as HTMLElement
            if (target.matches('input, textarea, select, [contenteditable]')) return
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            const step = event.key === 'ArrowLeft' ? -1 : 1
            onChange(variants[(index + step + variants.length) % variants.length].key)
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [index, variants, onChange])

    function go(step: number) {
        onChange(variants[(index + step + variants.length) % variants.length].key)
    }

    return (
        <div className="pc-switcher" role="group" aria-label="Prototype variants">
            <button type="button" onClick={() => go(-1)} aria-label="Previous variant">←</button>
            <span>{variants[index].key} ({variants[index].name})</span>
            <button type="button" onClick={() => go(1)} aria-label="Next variant">→</button>
        </div>
    )
}
