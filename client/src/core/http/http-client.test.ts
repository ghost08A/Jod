import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestJson } from './http-client'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** A fetch that never answers and rejects the way a browser does when its signal aborts */
function hangingFetch(_input: string, init?: RequestInit) {
    return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('requestJson', () => {
    it('keeps working for a plain call', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { ok: 1 }))

        const result = await requestJson<{ ok: number }>('/x', { authorized: false, method: 'POST', body: { a: 1 } })

        expect(result).toEqual({ ok: 1 })
        const init = fetchMock.mock.calls[0][1] as RequestInit
        expect(init.method).toBe('POST')
        expect(init.body).toBe('{"a":1}')
        expect(init.keepalive).toBeUndefined()
    })

    it('passes keepalive to fetch', async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, {}))

        await requestJson('/x', { authorized: false, keepalive: true })

        expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true)
    })

    it('gives a timeout as a transient error with status 408', async () => {
        vi.useFakeTimers()
        fetchMock.mockImplementation(hangingFetch)

        const result = requestJson('/x', { authorized: false, timeoutMs: 1000 }).catch((error: unknown) => error)
        await vi.advanceTimersByTimeAsync(1000)

        expect(await result).toMatchObject({ status: 408, transient: true })
    })

    it('uses 15 seconds by default', async () => {
        vi.useFakeTimers()
        fetchMock.mockImplementation(hangingFetch)

        const result = requestJson('/x', { authorized: false }).catch((error: unknown) => error)
        await vi.advanceTimersByTimeAsync(14_999)
        expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)

        expect(await result).toMatchObject({ status: 408 })
    })

    it('tells offline (status 0, not transient) apart from a timeout', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

        const error = await requestJson('/x', { authorized: false }).catch((caught: unknown) => caught)

        expect(error).toMatchObject({ status: 0, transient: false })
    })

    it('rethrows a cancel from the caller as the original AbortError', async () => {
        fetchMock.mockImplementation(hangingFetch)
        const controller = new AbortController()

        const result = requestJson('/x', { authorized: false, signal: controller.signal }).catch((error: unknown) => error)
        controller.abort()
        const error = await result

        expect(error).toBeInstanceOf(DOMException)
        expect((error as DOMException).name).toBe('AbortError')
    })

    it('keeps the extension members of a 409 body', async () => {
        const note = { id: 'n1', version: 3 }
        fetchMock.mockResolvedValue(
            jsonResponse(409, { status: 409, detail: 'ขัดแย้ง', reference: 'AB23CD45', currentNote: note }),
        )

        const error = await requestJson('/x', { authorized: false }).catch((caught: unknown) => caught)

        expect(error).toMatchObject({ status: 409, reference: 'AB23CD45', extensions: { currentNote: note } })
    })

    describe('while the response body is being read', () => {
        /** Headers arrive at once, then json() hangs until the request signal aborts */
        function stalledBodyFetch(_input: string, init?: RequestInit) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    new Promise((_resolve, reject) => {
                        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
                    }),
            } as Response)
        }

        it('maps a timeout to the transient 408 error', async () => {
            vi.useFakeTimers()
            fetchMock.mockImplementation(stalledBodyFetch)

            const result = requestJson('/x', { authorized: false, timeoutMs: 1000 }).catch((error: unknown) => error)
            await vi.advanceTimersByTimeAsync(1000)

            expect(await result).toMatchObject({ status: 408, transient: true })
        })

        it('keeps a cancel from the caller as the original AbortError', async () => {
            fetchMock.mockImplementation(stalledBodyFetch)
            const controller = new AbortController()

            const result = requestJson('/x', { authorized: false, signal: controller.signal }).catch(
                (error: unknown) => error,
            )
            await new Promise((resolve) => setTimeout(resolve, 0))
            controller.abort()
            const error = await result

            expect(error).toBeInstanceOf(DOMException)
            expect((error as DOMException).name).toBe('AbortError')
        })
    })
})
