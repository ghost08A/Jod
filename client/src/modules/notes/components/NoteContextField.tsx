import { useLayoutEffect, useRef, useState } from 'react'

// Note: the server counts Unicode code points (2000) and maxLength counts UTF-16 units, so maxLength can only be stricter
const NOTE_CONTEXT_MAX_LENGTH = 2000

type NoteContextFieldProps = {
    initialContext: string
    /** Called with the whole context after every change */
    onContextChange?: (context: string) => void
    isReadOnly?: boolean
}

export function NoteContextField({ initialContext, onContextChange, isReadOnly }: NoteContextFieldProps) {
    const [context, setContext] = useState(initialContext)
    const fieldRef = useRef<HTMLTextAreaElement>(null)

    // Note: looks like one line and grows with its text. Width changes of the window are not re-measured
    useLayoutEffect(() => {
        const field = fieldRef.current
        if (!field) return
        field.style.height = 'auto'
        field.style.height = `${field.scrollHeight}px`
    }, [context])

    return (
        <textarea
            ref={fieldRef}
            className="notes-context"
            rows={1}
            value={context}
            onChange={(event) => {
                setContext(event.target.value)
                onContextChange?.(event.target.value)
            }}
            readOnly={isReadOnly}
            maxLength={NOTE_CONTEXT_MAX_LENGTH}
            placeholder="บริบทของโน้ตนี้…"
            aria-label="บริบทของโน้ต"
        />
    )
}
