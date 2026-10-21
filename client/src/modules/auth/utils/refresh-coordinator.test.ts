import { describe, expect, it, vi } from 'vitest'
import type { AuthSession, SessionMessage } from '../types/auth-session'
import { createRefreshCoordinator } from './refresh-coordinator'

const NOW = 1_000_000

function makeSession(accessToken: string, expiresAt = NOW + 15 * 60_000): AuthSession {
    return { accessToken, expiresAt, user: { id: '1', email: 'a@example.com' } }
}

/** One lock shared by everyone who calls it, like Web Locks shared by every tab */
function makeSharedLock() {
    let tail: Promise<unknown> = Promise.resolve()
    return <T>(work: () => Promise<T>): Promise<T> => {
        const run = tail.then(work, work)
        tail = run.catch(() => undefined)
        return run
    }
}

/** Delivers a message to every coordinator except the sender, like BroadcastChannel */
function makeFakeBrowser() {
    const runExclusive = makeSharedLock()
    const tabs: Array<ReturnType<typeof createRefreshCoordinator>> = []

    function openTab(requestRefresh: () => Promise<AuthSession | undefined>) {
        const tab: ReturnType<typeof createRefreshCoordinator> = createRefreshCoordinator({
            runExclusive,
            requestRefresh,
            now: () => NOW,
            broadcast: (message: SessionMessage) => tabs.filter((other) => other !== tab).forEach((other) => other.receive(message)),
        })
        tabs.push(tab)
        return tab
    }

    return { openTab }
}

describe('createRefreshCoordinator', () => {
    it('sends one renewal request when several requests in a tab need a new token at once', async () => {
        const requestRefresh = vi.fn().mockResolvedValue(makeSession('new'))
        const tab = makeFakeBrowser().openTab(requestRefresh)

        const results = await Promise.all([tab.refresh(), tab.refresh(), tab.refresh()])

        expect(requestRefresh).toHaveBeenCalledTimes(1)
        expect(results.map((session) => session?.accessToken)).toEqual(['new', 'new', 'new'])
    })

    it('sends one renewal request in total when two tabs need a new token at the same time', async () => {
        const browser = makeFakeBrowser()
        const requestInTabA = vi.fn().mockResolvedValue(makeSession('from-tab-a'))
        const requestInTabB = vi.fn().mockResolvedValue(makeSession('from-tab-b'))
        const tabA = browser.openTab(requestInTabA)
        const tabB = browser.openTab(requestInTabB)

        const [resultA, resultB] = await Promise.all([tabA.refresh(), tabB.refresh()])

        expect(requestInTabA.mock.calls.length + requestInTabB.mock.calls.length).toBe(1)
        expect(resultA?.accessToken).toBe(resultB?.accessToken)
        expect(tabA.getCurrent()?.accessToken).toBe(tabB.getCurrent()?.accessToken)
    })

    it('renews again when the token it holds is the one the server just rejected', async () => {
        const requestRefresh = vi.fn().mockResolvedValue(makeSession('second'))
        const tab = makeFakeBrowser().openTab(requestRefresh)
        tab.adopt(makeSession('first'))

        const session = await tab.refresh('first')

        expect(requestRefresh).toHaveBeenCalledTimes(1)
        expect(session?.accessToken).toBe('second')
    })

    it('reuses a token that is still fresh and was not rejected', async () => {
        const requestRefresh = vi.fn()
        const tab = makeFakeBrowser().openTab(requestRefresh)
        tab.adopt(makeSession('fresh'))

        const session = await tab.refresh('some-older-token')

        expect(requestRefresh).not.toHaveBeenCalled()
        expect(session?.accessToken).toBe('fresh')
    })

    it('renews a token that is about to expire', async () => {
        const requestRefresh = vi.fn().mockResolvedValue(makeSession('renewed'))
        const tab = makeFakeBrowser().openTab(requestRefresh)
        tab.adopt(makeSession('almost-expired', NOW + 10_000))

        const session = await tab.refresh()

        expect(requestRefresh).toHaveBeenCalledTimes(1)
        expect(session?.accessToken).toBe('renewed')
    })

    it('forgets the session and resolves undefined when the server refuses, then tries again next time', async () => {
        const requestRefresh = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(makeSession('later'))
        const tab = makeFakeBrowser().openTab(requestRefresh)
        tab.adopt(makeSession('old', NOW - 1))

        const refused = await tab.refresh('old')
        const retried = await tab.refresh()

        expect(refused).toBeUndefined()
        expect(retried?.accessToken).toBe('later')
        expect(requestRefresh).toHaveBeenCalledTimes(2)
    })

    it('releases the lock when the request fails, so later renewals still work', async () => {
        const requestRefresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(makeSession('back'))
        const tab = makeFakeBrowser().openTab(requestRefresh)

        await expect(tab.refresh()).rejects.toThrow('offline')
        const session = await tab.refresh()

        expect(session?.accessToken).toBe('back')
    })

    it('shares sign-in and sign-out with the other tabs', () => {
        const browser = makeFakeBrowser()
        const tabA = browser.openTab(vi.fn())
        const tabB = browser.openTab(vi.fn())

        tabA.adopt(makeSession('signed-in'))
        expect(tabB.getCurrent()?.accessToken).toBe('signed-in')

        tabA.signOut()
        expect(tabA.getCurrent()).toBeUndefined()
        expect(tabB.getCurrent()).toBeUndefined()
    })

    it('does not tell other tabs when this tab only forgets a rejected session', () => {
        const browser = makeFakeBrowser()
        const tabA = browser.openTab(vi.fn())
        const tabB = browser.openTab(vi.fn())
        tabA.adopt(makeSession('shared'))

        tabA.forget()

        expect(tabA.getCurrent()).toBeUndefined()
        expect(tabB.getCurrent()?.accessToken).toBe('shared')
    })

    it('notifies subscribers of every change until they unsubscribe', () => {
        const tab = makeFakeBrowser().openTab(vi.fn())
        const listener = vi.fn()
        const unsubscribe = tab.subscribe(listener)

        tab.adopt(makeSession('one'))
        tab.signOut()
        unsubscribe()
        tab.adopt(makeSession('two'))

        expect(listener).toHaveBeenCalledTimes(2)
        expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ accessToken: 'one' }))
        expect(listener).toHaveBeenNthCalledWith(2, undefined)
    })
})
