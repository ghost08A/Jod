export type AuthUser = {
    id: string
    email: string
}

export type AuthSession = {
    accessToken: string
    /** Milliseconds since 1970, when the access token stops being accepted */
    expiresAt: number
    user: AuthUser
}

/** What tabs of the same browser tell each other */
export type SessionMessage = { type: 'session'; session: AuthSession } | { type: 'signedOut' }
