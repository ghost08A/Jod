import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../../modules/auth/hooks/useAuth'

/** Shows the pages inside it only to a signed-in user; everyone else goes to the sign-in page */
export function RequireAuth() {
    const { status, retry } = useAuth()

    if (status === 'loading') {
        return (
            <main className="auth-page">
                <div className="auth-card" role="status" aria-label="กำลังโหลด">
                    <span className="skeleton skeleton-title" />
                    <span className="skeleton" />
                </div>
            </main>
        )
    }

    if (status === 'unavailable') {
        return (
            <main className="auth-page">
                <div className="auth-card">
                    <h1>เชื่อมต่อระบบไม่ได้</h1>
                    <p className="auth-error" role="alert">
                        ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง
                    </p>
                    <button className="button-primary" type="button" onClick={retry}>
                        ลองอีกครั้ง
                    </button>
                </div>
            </main>
        )
    }

    return status === 'signedIn' ? <Outlet /> : <Navigate to="/login" replace />
}
