export const MAX_SEARCH_LENGTH = 200

/** The text to send to the server, or undefined when nothing should be searched (blank, or longer than the server accepts) */
export function toSearchQuery(rawText: string): string | undefined {
    const trimmed = rawText.trim()
    return trimmed.length > 0 && trimmed.length <= MAX_SEARCH_LENGTH ? trimmed : undefined
}
