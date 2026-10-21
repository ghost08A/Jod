import { useEffect, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { fetchCurrentUser } from '../services/auth-service'
import type { AuthUser } from '../types/auth-session'

export function useCurrentUser() {
    const [user, setUser] = useState<AuthUser | undefined>(undefined)
    const [error, setError] = useState<ApiError | undefined>(undefined)

    useEffect(() => {
        let isCancelled = false
        fetchCurrentUser()
            .then((current) => {
                if (!isCancelled) setUser(current)
            })
            .catch((failure: unknown) => {
                if (!isCancelled) setError(failure instanceof ApiError ? failure : toApiError(0, undefined))
            })
        return () => {
            isCancelled = true
        }
    }, [])

    return { user, error }
}
