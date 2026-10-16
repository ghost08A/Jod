import { DEFAULT_TITLE } from '../constants/seed-notes'
import type { PrototypeNote } from '../types/prototype-note'

export function displayTitle(note: PrototypeNote): string {
    return note.title || DEFAULT_TITLE
}

export function bodyPreview(note: PrototypeNote): string {
    const firstLine = note.body.split('\n')[0] ?? ''
    return firstLine.length > 36 ? `${firstLine.slice(0, 36)}…` : firstLine
}

export function parentLabel(notes: PrototypeNote[], parentId: string | undefined): string {
    const parent = notes.find((note) => note.id === parentId)
    return parent ? displayTitle(parent) : '—'
}

export function notePath(notes: PrototypeNote[], note: PrototypeNote): string {
    const titles: string[] = []
    let current: PrototypeNote | undefined = note
    while (current) {
        titles.unshift(displayTitle(current))
        current = current.placement === 'child' ? notes.find((item) => item.id === current?.parentId) : undefined
    }
    return titles.join(' / ')
}

export function isEmptyDraft(note: PrototypeNote): boolean {
    return note.isDraft && note.title === '' && note.body.trim() === ''
}
