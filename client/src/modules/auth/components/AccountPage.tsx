import { useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { useAuth } from '../hooks/useAuth'
import { useCurrentUser } from '../hooks/useCurrentUser'
import './auth.css'

// Note: this page exists to show that the access token works (it reads the email from the server)
export function AccountPage() {
    const { logout } = useAuth()
    const { user, error } = useCurrentUser()
    const [isSigningOut, setIsSigningOut] = useState(false)
    const [signOutError, setSignOutError] = useState<ApiError | undefined>(undefined)

    async function handleSignOut() {
        setSignOutError(undefined)
        setIsSigningOut(true)
        try {
            await logout()
        } catch (failure) {
            setSignOutError(failure instanceof ApiError ? failure : toApiError(0, undefined))
            setIsSigningOut(false)
        }
    }

    const shownError = error ?? signOutError

    return (
        <main className="auth-page">
            <div className="auth-card">
                <h1>บัญชีของฉัน</h1>
                <div className="account-row">
                    <span className="account-label">อีเมล</span>
                    {user ? (
                        <span className="account-value">{user.email}</span>
                    ) : (
                        !error && <span className="skeleton" aria-label="กำลังโหลด" role="status" />
                    )}
                </div>

                {shownError && (
                    <div className="auth-error" role="alert">
                        <p>{shownError.message}</p>
                        {shownError.reference && <p className="auth-error-reference">รหัสอ้างอิง: {shownError.reference}</p>}
                    </div>
                )}

                <button className="button-primary" type="button" onClick={handleSignOut} disabled={isSigningOut} aria-busy={isSigningOut}>
                    {isSigningOut && <span className="spinner" aria-hidden="true" />}
                    {isSigningOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
                </button>
            </div>
        </main>
    )
}
