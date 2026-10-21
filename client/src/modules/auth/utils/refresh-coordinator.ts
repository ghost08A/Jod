import type { AuthSession, SessionMessage } from '../types/auth-session'

export type RefreshCoordinatorDependencies = {
    /** Runs the function while holding a lock shared by every tab (Web Locks) */
    runExclusive: <T>(work: () => Promise<T>) => Promise<T>
    /** Asks the server for a new session with the refresh cookie. Resolves undefined when the server refuses */
    requestRefresh: () => Promise<AuthSession | undefined>
    broadcast: (message: SessionMessage) => void
    now: () => number
}

// A token that expires within this time is renewed instead of reused
const MIN_REMAINING_MS = 30_000

/**
 * Keeps the access token in memory and makes sure that, however many requests or tabs ask for a
 * renewal at the same time, only one request reaches the server. The refresh token rotates on every
 * use and an old one is treated as stolen, so two renewals with the same cookie would sign the user out.
 */
export function createRefreshCoordinator(dependencies: RefreshCoordinatorDependencies) {
    const { runExclusive, requestRefresh, broadcast, now } = dependencies
    let current: AuthSession | undefined
    const listeners = new Set<(session: AuthSession | undefined) => void>()

    function change(session: AuthSession | undefined) {
        current = session
        listeners.forEach((listener) => listener(session))
    }

    return {
        getCurrent: () => current,

        subscribe(listener: (session: AuthSession | undefined) => void) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },

        /** A session made by sign-in or sign-up in this tab */
        adopt(session: AuthSession) {
            change(session)
            broadcast({ type: 'session', session })
        },

        /** A message from another tab of this browser */
        receive(message: SessionMessage) {
            change(message.type === 'session' ? message.session : undefined)
        },

        /** The user chose to sign out: this tab forgets the session and tells the other tabs */
        signOut() {
            change(undefined)
            broadcast({ type: 'signedOut' })
        },

        /** The server rejected this tab's session. Forget it; other tabs find out on their own */
        forget() {
            change(undefined)
        },

        /**
         * Returns a usable session, renewing it if needed. Pass the token the server just rejected so
         * it is never handed out again. Resolves undefined when the user has to sign in again.
         */
        refresh(rejectedToken?: string): Promise<AuthSession | undefined> {
            return runExclusive(async () => {
                // Note: while this call waited for the lock, this tab or another one may have renewed already
                const alreadyRenewed =
                    current !== undefined &&
                    current.accessToken !== rejectedToken &&
                    current.expiresAt - now() > MIN_REMAINING_MS
                if (alreadyRenewed) return current

                const session = await requestRefresh()
                change(session)
                if (session) broadcast({ type: 'session', session })
                return session
            })
        },
    }
}

export type RefreshCoordinator = ReturnType<typeof createRefreshCoordinator>
