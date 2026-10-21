import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue, type AuthStatus } from '../../modules/auth/hooks/auth-context'
import * as authService from '../../modules/auth/services/auth-service'
import { sessionCoordinator } from '../../modules/auth/services/browser-session'
import type { AuthUser } from '../../modules/auth/types/auth-session'

type AuthState = { status: AuthStatus; user: AuthUser | undefined; sessionEnded: boolean }

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ status: 'loading', user: undefined, sessionEnded: false })
    const [restoreAttempt, setRestoreAttempt] = useState(0)
    const isSigningOutByChoice = useRef(false)

    // Every change of the session, from this tab or another one, ends up here
    useEffect(
        () =>
            sessionCoordinator.subscribe((session) =>
                setState((previous) =>
                    session
                        ? { status: 'signedIn', user: session.user, sessionEnded: false }
                        : {
                              status: 'signedOut',
                              user: undefined,
                              // Note: the same sign-out can be reported twice in a row, and the second report must not erase the first
                              sessionEnded:
                                  previous.status === 'signedIn' ? !isSigningOutByChoice.current : previous.sessionEnded,
                          },
                ),
            ),
        [],
    )

    // Opening or reloading the page: the access token is gone from memory, so ask for a new one with the cookie
    useEffect(() => {
        let isCancelled = false
        sessionCoordinator
            .refresh()
            .then((session) => {
                if (isCancelled) return
                setState(
                    session
                        ? { status: 'signedIn', user: session.user, sessionEnded: false }
                        : { status: 'signedOut', user: undefined, sessionEnded: false },
                )
            })
            .catch(() => {
                if (!isCancelled) setState({ status: 'unavailable', user: undefined, sessionEnded: false })
            })
        return () => {
            isCancelled = true
        }
    }, [restoreAttempt])

    const signInWithGoogle = useCallback(async (credential: string) => {
        sessionCoordinator.adopt(await authService.signInWithGoogle(credential))
    }, [])

    const logout = useCallback(async () => {
        // Note: if the server cannot be reached the user stays signed in, because the cookie is still valid
        await authService.logout()
        isSigningOutByChoice.current = true
        sessionCoordinator.signOut()
        isSigningOutByChoice.current = false
    }, [])

    const retry = useCallback(() => {
        setState({ status: 'loading', user: undefined, sessionEnded: false })
        setRestoreAttempt((attempt) => attempt + 1)
    }, [])

    const value = useMemo<AuthContextValue>(
        () => ({ ...state, signInWithGoogle, logout, retry }),
        [state, signInWithGoogle, logout, retry],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
