import { toApiError, toConnectionError, toTimeoutError } from './api-error'
import { createAuthorizedFetch, type SessionSource } from './authorized-fetch'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

// Note: the auth module plugs itself in here, so this file knows nothing about how sessions work
let sessionSource: SessionSource | undefined

export function registerSessionSource(source: SessionSource) {
    sessionSource = source
}

const authorizedFetch = createAuthorizedFetch((input, init) => fetch(input, init), {
    getAccessToken: () => sessionSource?.getAccessToken(),
    refresh: (rejectedToken) => sessionSource?.refresh(rejectedToken) ?? Promise.resolve(undefined),
    onSessionLost: () => sessionSource?.onSessionLost(),
})

type RequestOptions = {
    method?: string
    body?: unknown
    headers?: Record<string, string>
    /** false for the sign-in calls themselves, which have no access token to send */
    authorized?: boolean
    /** Lets the request finish while the page closes (used for the last save) */
    keepalive?: boolean
    /** Milliseconds before the request is given up as a transient timeout. Default 15 seconds */
    timeoutMs?: number
    /** Cancels the request. A cancel is rethrown as the original AbortError, not as an ApiError */
    signal?: AbortSignal
}

export const DEFAULT_TIMEOUT_MS = 15_000

/** Sends a request and returns its JSON. Every failure is thrown as an ApiError, except a cancel through `signal`. */
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers, authorized = true, keepalive, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options
    const send = authorized ? authorizedFetch : (input: string, init?: RequestInit) => fetch(input, init)

    const timeout = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        timeout.abort()
    }, timeoutMs)

    try {
        let response: Response
        try {
            response = await send(`${baseUrl}${path}`, {
                method,
                headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
                body: body === undefined ? undefined : JSON.stringify(body),
                keepalive,
                signal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal,
            })
        } catch (error) {
            if (timedOut) throw toTimeoutError()
            if (signal?.aborted) throw error
            throw toConnectionError()
        }

        if (!response.ok) {
            const problem: unknown = await response.json().catch(() => undefined)
            throw toApiError(response.status, problem)
        }
        if (response.status === 204) return undefined as T
        try {
            return (await response.json()) as T
        } catch (error) {
            if (timedOut) throw toTimeoutError()
            throw error
        }
    } finally {
        clearTimeout(timer)
    }
}

export function getJson<T>(path: string): Promise<T> {
    return requestJson<T>(path)
}
