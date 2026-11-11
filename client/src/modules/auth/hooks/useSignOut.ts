import { useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { useAuth } from './useAuth'

/** Signs the user out. If the server cannot be reached the user stays signed in and `error` says why */
export function useSignOut() {
    const { logout } = useAuth()
    const [isSigningOut, setIsSigningOut] = useState(false)
    const [error, setError] = useState<ApiError | undefined>(undefined)

    async function signOut() {
        setError(undefined)
        setIsSigningOut(true)
        try {
            await logout()
        } catch (failure) {
            setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
            setIsSigningOut(false)
        }
    }

    return { signOut, isSigningOut, error }
}
