export type LatestRequestGate = {
    /** Call when a request starts. Returns its token and makes every earlier token stale */
    begin: () => number
    /** True only for the token of the newest request, and only if nobody called cancel since */
    isCurrent: (token: number) => boolean
    /** Makes every token stale (the screen was left, or the note changed) */
    cancel: () => void
}

/** Lets a screen ignore an answer that arrives late for something it no longer shows */
export function createLatestRequestGate(): LatestRequestGate {
    let latestToken = 0
    let isCancelled = false
    return {
        begin: () => {
            isCancelled = false
            latestToken += 1
            return latestToken
        },
        isCurrent: (token) => !isCancelled && token === latestToken,
        cancel: () => {
            isCancelled = true
        },
    }
}
