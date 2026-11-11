/**
 * A "/" opens the slash menu only at the start of a line or after whitespace, so a "/" inside a URL or a path
 * (https://a.b/c, a/b) stays plain text. Takes the text of the line before the "/".
 */
export function isSlashTriggerAllowed(textBeforeSlash: string): boolean {
    return textBeforeSlash.length === 0 || /\s$/.test(textBeforeSlash)
}
