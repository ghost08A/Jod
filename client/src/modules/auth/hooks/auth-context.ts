import { createContext } from 'react'
import type { AuthUser } from '../types/auth-session'

export type AuthStatus =
    /** Asking the server whether the refresh cookie still gives a session */
    | 'loading'
    | 'signedIn'
    | 'signedOut'
    /** The server could not be reached, so it is not known whether the user is signed in */
    | 'unavailable'

export type AuthContextValue = {
    status: AuthStatus
    user: AuthUser | undefined
    /** True when the user was signed out without asking for it (session expired or revoked) */
    sessionEnded: boolean
    signInWithGoogle: (credential: string) => Promise<void>
    logout: () => Promise<void>
    retry: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
