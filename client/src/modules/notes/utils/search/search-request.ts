import type { SearchOptions, SearchScope } from '../../types/note'

/** The server options for what the user chose. The branch filter only exists outside Trash, so Trash drops it (the server answers 400 for both) */
export function toSearchOptions(scope: SearchScope, parentId: string | undefined): SearchOptions {
    return scope === 'trash' ? { inTrash: true } : parentId === undefined ? {} : { parentId }
}

/** The search URL. A branch filter together with Trash is a mistake in the caller, so it throws instead of sending it */
export function buildSearchPath(query: string, skip: number, options: SearchOptions = {}): string {
    if (options.parentId !== undefined && options.inTrash) throw new Error('A search cannot filter by branch and search the Trash at once')
    const parts = [`q=${encodeURIComponent(query)}`, `skip=${skip}`]
    if (options.parentId !== undefined) parts.push(`parentId=${encodeURIComponent(options.parentId)}`)
    if (options.inTrash) parts.push('inTrash=true')
    return `/api/notes/search?${parts.join('&')}`
}
