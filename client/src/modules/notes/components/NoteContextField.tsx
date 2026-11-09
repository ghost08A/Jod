import { useLayoutEffect, useRef, useState } from 'react'

// Note: the server counts Unicode code points (2000) and maxLength counts UTF-16 units, so maxLength can only be stricter
const NOTE_CONTEXT_MAX_LENGTH = 2000

type NoteContextFieldProps = {
    initialContext: string
}

export function NoteContextField({ initialContext }: NoteContextFieldProps) {
    // Note: nothing is saved yet (autosave is ticket #21). The text lives only in this component and is dropped when another note opens
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
            onChange={(event) => setContext(event.target.value)}
            maxLength={NOTE_CONTEXT_MAX_LENGTH}
            placeholder="บริบทของโน้ตนี้…"
            aria-label="บริบทของโน้ต"
        />
    )
}
