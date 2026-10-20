import { toApiError, toConnectionError } from './api-error'
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
}

/** Sends a request and returns its JSON. Every failure is thrown as an ApiError. */
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers, authorized = true } = options
    const send = authorized ? authorizedFetch : (input: string, init?: RequestInit) => fetch(input, init)

    let response: Response
    try {
        response = await send(`${baseUrl}${path}`, {
            method,
            headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
    } catch {
        throw toConnectionError()
    }

    if (!response.ok) {
        const problem: unknown = await response.json().catch(() => undefined)
        throw toApiError(response.status, problem)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
}

export function getJson<T>(path: string): Promise<T> {
    return requestJson<T>(path)
}
