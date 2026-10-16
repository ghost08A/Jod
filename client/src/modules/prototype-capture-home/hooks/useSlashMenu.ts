import { useCallback, useState } from 'react'

export type SlashStep = 'reference' | 'link' | 'name'

export interface SlashTrigger {
    start: number
    query: string
    top: number
}

// Note: tracks "/" typed at the start of a line or after a space; the text after it is the filter
export function useSlashMenu() {
    const [trigger, setTrigger] = useState<SlashTrigger | undefined>()
    const [active, setActive] = useState(0)
    const [step, setStep] = useState<SlashStep | undefined>()

    const detect = useCallback((value: string, caret: number, measureTop: () => number) => {
        const lineStart = value.lastIndexOf('\n', caret - 1) + 1
        const segment = value.slice(lineStart, caret)
        const match = /(^|\s)\/(\S*)$/.exec(segment)
        if (!match) {
            setTrigger(undefined)
            return
        }
        setTrigger({ start: lineStart + match.index + match[1].length, query: match[2], top: measureTop() })
        setActive(0)
    }, [])

    const close = useCallback(() => {
        setTrigger(undefined)
        setStep(undefined)
        setActive(0)
    }, [])

    return { trigger, active, setActive, step, setStep, detect, close }
}
