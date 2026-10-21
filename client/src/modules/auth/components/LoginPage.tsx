import { useCallback, useState } from 'react'
import { Navigate } from 'react-router'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { useAuth } from '../hooks/useAuth'
import { GoogleSignInButton } from './GoogleSignInButton'
import './auth.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function LoginPage() {
    const { status, sessionEnded, signInWithGoogle } = useAuth()
    const [submitError, setSubmitError] = useState<ApiError | undefined>(undefined)
    const [isSigningIn, setIsSigningIn] = useState(false)
    const [hasScriptFailed, setHasScriptFailed] = useState(false)

    const handleCredential = useCallback(
        async (credential: string) => {
            setSubmitError(undefined)
            setIsSigningIn(true)
            try {
                await signInWithGoogle(credential)
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error : toApiError(0, undefined))
            } finally {
                setIsSigningIn(false)
            }
        },
        [signInWithGoogle],
    )
    const handleScriptFailed = useCallback(() => setHasScriptFailed(true), [])

    // Signed in already (maybe in another tab): nothing to do on this page
    if (status === 'signedIn') return <Navigate to="/" replace />

    return (
        <main className="auth-page">
            <div className="auth-card">
                <h1>เข้าสู่ระบบ</h1>

                {sessionEnded && (
                    <p className="auth-notice" role="status">
                        เซสชันสิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่
                    </p>
                )}

                {GOOGLE_CLIENT_ID ? (
                    <div className={isSigningIn ? 'auth-google-wrapper auth-google-wrapper-busy' : 'auth-google-wrapper'}>
                        <GoogleSignInButton
                            clientId={GOOGLE_CLIENT_ID}
                            onCredential={handleCredential}
                            onLoadError={handleScriptFailed}
                        />
                    </div>
                ) : (
                    <p className="auth-error" role="alert">
                        ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID ดูวิธีตั้งค่าใน README
                    </p>
                )}

                {isSigningIn && (
                    <p className="auth-progress" role="status">
                        <span className="spinner" aria-hidden="true" />
                        กำลังเข้าสู่ระบบ…
                    </p>
                )}

                {hasScriptFailed && (
                    <p className="auth-error" role="alert">
                        โหลดปุ่มเข้าสู่ระบบด้วย Google ไม่ได้ ตรวจสอบอินเทอร์เน็ต (หรือตัวบล็อกโฆษณา) แล้วโหลดหน้าใหม่
                    </p>
                )}

                {submitError && (
                    <div className="auth-error" role="alert">
                        <p>{submitError.message}</p>
                        {submitError.reference && <p className="auth-error-reference">รหัสอ้างอิง: {submitError.reference}</p>}
                    </div>
                )}
            </div>
        </main>
    )
}
