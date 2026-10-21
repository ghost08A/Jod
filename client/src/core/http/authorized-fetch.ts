export type SessionSource = {
    getAccessToken: () => string | undefined
    /** Renews the session. Pass the token the server rejected. Resolves the new token, or undefined when the user must sign in again */
    refresh: (rejectedToken: string | undefined) => Promise<string | undefined>
    /** Called when the session cannot be saved, so the app can go back to the sign-in page */
    onSessionLost: () => void
}

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Wraps fetch: adds the access token, and when the server answers 401 renews the session and
 * sends the same request again once. A second 401 is final, so it can never loop.
 * Note: the request is sent twice, so its body must be a string (JSON), not a stream.
 */
export function createAuthorizedFetch(fetchFunction: FetchFunction, source: SessionSource): FetchFunction {
    const send = (input: string, init: RequestInit | undefined, token: string | undefined) => {
        const headers = new Headers(init?.headers)
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetchFunction(input, { ...init, headers })
    }

    return async (input, init) => {
        const usedToken = source.getAccessToken()
        const first = await send(input, init, usedToken)
        if (first.status !== 401) return first

        const renewedToken = await source.refresh(usedToken)
        if (!renewedToken) {
            source.onSessionLost()
            return first
        }

        const second = await send(input, init, renewedToken)
        if (second.status === 401) source.onSessionLost()
        return second
    }
}
