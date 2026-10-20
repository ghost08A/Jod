import { ApiError } from '../../../core/http/api-error'
import { getJson, requestJson } from '../../../core/http/http-client'
import type { AuthSession, AuthUser } from '../types/auth-session'

type AuthResultResponse = {
    accessToken: string
    expiresInSeconds: number
    user: AuthUser
}

// Note: without this header the server refuses to renew or sign out, so a page on another
// site cannot make the browser do it with the refresh cookie
const REQUESTED_WITH = { 'X-Requested-With': 'jod' }

function toSession(result: AuthResultResponse): AuthSession {
    return {
        accessToken: result.accessToken,
        expiresAt: Date.now() + result.expiresInSeconds * 1000,
        user: result.user,
    }
}

export async function register(email: string, password: string): Promise<AuthSession> {
    const result = await requestJson<AuthResultResponse>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
        authorized: false,
    })
    return toSession(result)
}

export async function login(email: string, password: string): Promise<AuthSession> {
    const result = await requestJson<AuthResultResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        authorized: false,
    })
    return toSession(result)
}

/**
 * Trades the refresh cookie for a new session. Resolves undefined when the server says the
 * cookie is missing, expired or revoked (the user must sign in again). Other failures, such as
 * no network or a server error, are thrown, because they do not mean the user is signed out.
 */
export async function refreshSession(): Promise<AuthSession | undefined> {
    try {
        const result = await requestJson<AuthResultResponse>('/api/auth/refresh', {
            method: 'POST',
            headers: REQUESTED_WITH,
            authorized: false,
        })
        return toSession(result)
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return undefined
        throw error
    }
}

export async function logout(): Promise<void> {
    await requestJson<void>('/api/auth/logout', {
        method: 'POST',
        headers: REQUESTED_WITH,
        authorized: false,
    })
}

export function fetchCurrentUser(): Promise<AuthUser> {
    return getJson<AuthUser>('/api/me')
}
