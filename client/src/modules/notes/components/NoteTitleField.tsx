import { useState } from 'react'

// Note: the server counts Unicode code points (200) and maxLength counts UTF-16 units, so maxLength can only be stricter
const NOTE_TITLE_MAX_LENGTH = 200

type NoteTitleFieldProps = {
    initialTitle: string
    /** Called with the whole title after every change */
    onTitleChange: (title: string) => void
}

export function NoteTitleField({ initialTitle, onTitleChange }: NoteTitleFieldProps) {
    const [title, setTitle] = useState(initialTitle)

    return (
        <input
            className="notes-title"
            type="text"
            value={title}
            onChange={(event) => {
                setTitle(event.target.value)
                onTitleChange(event.target.value)
            }}
            maxLength={NOTE_TITLE_MAX_LENGTH}
            placeholder="Untitled"
            aria-label="ชื่อโน้ต"
        />
    )
}
