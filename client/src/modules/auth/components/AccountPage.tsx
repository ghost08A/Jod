import { Link } from 'react-router'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useSignOut } from '../hooks/useSignOut'
import './auth.css'

// Note: this page exists to show that the access token works (it reads the email from the server)
export function AccountPage() {
    const { user, error } = useCurrentUser()
    const { signOut, isSigningOut, error: signOutError } = useSignOut()
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

                {shownError && <ErrorMessage styleScope="auth" message={shownError.message} reference={shownError.reference} />}

                <button className="button-primary" type="button" onClick={signOut} disabled={isSigningOut} aria-busy={isSigningOut}>
                    {isSigningOut && <span className="spinner" aria-hidden="true" />}
                    {isSigningOut ? 'กำลังออกจากระบบ…' : 'ออกจากระบบ'}
                </button>
                <Link className="account-back-link" to="/">
                    กลับไปโน้ต
                </Link>
            </div>
        </main>
    )
}
