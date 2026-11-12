/** Line breaks become spaces and runs of whitespace become one space */
export function cleanSnippet(snippet: string): string {
    return snippet.replace(/\s+/g, ' ').trim()
}
