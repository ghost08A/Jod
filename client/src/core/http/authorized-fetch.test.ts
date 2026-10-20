import { describe, expect, it, vi } from 'vitest'
import { createAuthorizedFetch, type SessionSource } from './authorized-fetch'

function makeSource(overrides: Partial<SessionSource> = {}): SessionSource {
    return {
        getAccessToken: () => 'old-token',
        refresh: vi.fn().mockResolvedValue('new-token'),
        onSessionLost: vi.fn(),
        ...overrides,
    }
}

function authorizationOf(fetchMock: ReturnType<typeof vi.fn>, call: number) {
    const init = fetchMock.mock.calls[call][1] as RequestInit
    return new Headers(init.headers).get('Authorization')
}

describe('createAuthorizedFetch', () => {
    it('adds the access token to the request', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
        const authorizedFetch = createAuthorizedFetch(fetchMock, makeSource())

        await authorizedFetch('/api/me')

        expect(authorizationOf(fetchMock, 0)).toBe('Bearer old-token')
    })

    it('sends no Authorization header when there is no token', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
        const authorizedFetch = createAuthorizedFetch(fetchMock, makeSource({ getAccessToken: () => undefined }))

        await authorizedFetch('/api/me')

        expect(authorizationOf(fetchMock, 0)).toBeNull()
    })

    it('passes other statuses through without renewing', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
        const source = makeSource()
        const authorizedFetch = createAuthorizedFetch(fetchMock, source)

        const response = await authorizedFetch('/api/me')

        expect(response.status).toBe(500)
        expect(source.refresh).not.toHaveBeenCalled()
    })

    it('renews on 401 and sends the same request again once with the new token', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response('', { status: 401 }))
            .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
        const source = makeSource()
        const authorizedFetch = createAuthorizedFetch(fetchMock, source)

        const response = await authorizedFetch('/api/data', { method: 'POST', body: '{"a":1}' })

        expect(response.status).toBe(200)
        expect(source.refresh).toHaveBeenCalledWith('old-token')
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(authorizationOf(fetchMock, 1)).toBe('Bearer new-token')
        const retryInit = fetchMock.mock.calls[1][1] as RequestInit
        expect(retryInit.method).toBe('POST')
        expect(retryInit.body).toBe('{"a":1}')
        expect(source.onSessionLost).not.toHaveBeenCalled()
    })

    it('does not loop: a second 401 after renewing is final and ends the session', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
        const source = makeSource()
        const authorizedFetch = createAuthorizedFetch(fetchMock, source)

        const response = await authorizedFetch('/api/data')

        expect(response.status).toBe(401)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(source.refresh).toHaveBeenCalledTimes(1)
        expect(source.onSessionLost).toHaveBeenCalledTimes(1)
    })

    it('ends the session without a second request when renewing is refused', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
        const source = makeSource({ refresh: vi.fn().mockResolvedValue(undefined) })
        const authorizedFetch = createAuthorizedFetch(fetchMock, source)

        const response = await authorizedFetch('/api/data')

        expect(response.status).toBe(401)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(source.onSessionLost).toHaveBeenCalledTimes(1)
    })
})
