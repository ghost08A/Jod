import { useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { useAuth } from '../hooks/useAuth'
import { validateCredentials, type CredentialsErrors, type CredentialsMode } from '../utils/credentials-validation'
import './auth.css'

const TEXT = {
    login: { submit: 'เข้าสู่ระบบ', passwordAutocomplete: 'current-password' },
    register: { submit: 'สมัครสมาชิก', passwordAutocomplete: 'new-password' },
} as const

export function CredentialsForm({ mode }: { mode: CredentialsMode }) {
    const { status, sessionEnded, login, register } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fieldErrors, setFieldErrors] = useState<CredentialsErrors>({})
    const [submitError, setSubmitError] = useState<ApiError | undefined>(undefined)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const emailInput = useRef<HTMLInputElement>(null)
    const passwordInput = useRef<HTMLInputElement>(null)

    // Signed in already (maybe in another tab): nothing to do on this page
    if (status === 'signedIn') return <Navigate to="/" replace />

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSubmitError(undefined)

        const errors = validateCredentials(mode, { email, password })
        setFieldErrors(errors)
        if (errors.email) return emailInput.current?.focus()
        if (errors.password) return passwordInput.current?.focus()

        setIsSubmitting(true)
        try {
            await (mode === 'login' ? login : register)(email.trim(), password)
        } catch (error) {
            setSubmitError(error instanceof ApiError ? error : toApiError(0, undefined))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {sessionEnded && mode === 'login' && (
                <p className="auth-notice" role="status">
                    เซสชันสิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่
                </p>
            )}

            <div className="auth-field">
                <label htmlFor="email">อีเมล</label>
                <input
                    id="email"
                    ref={emailInput}
                    type="email"
                    inputMode="email"
                    autoComplete={mode === 'login' ? 'username' : 'email'}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={fieldErrors.email !== undefined}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
                {fieldErrors.email && (
                    <p id="email-error" className="auth-field-error">
                        {fieldErrors.email}
                    </p>
                )}
            </div>

            <div className="auth-field">
                <label htmlFor="password">รหัสผ่าน</label>
                <input
                    id="password"
                    ref={passwordInput}
                    type="password"
                    autoComplete={TEXT[mode].passwordAutocomplete}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={fieldErrors.password !== undefined}
                    aria-describedby={fieldErrors.password ? 'password-error' : mode === 'register' ? 'password-hint' : undefined}
                />
                {mode === 'register' && !fieldErrors.password && (
                    <p id="password-hint" className="auth-field-hint">
                        อย่างน้อย 10 ตัวอักษร
                    </p>
                )}
                {fieldErrors.password && (
                    <p id="password-error" className="auth-field-error">
                        {fieldErrors.password}
                    </p>
                )}
            </div>

            {submitError && (
                <div className="auth-error" role="alert">
                    <p>{submitError.message}</p>
                    {submitError.reference && <p className="auth-error-reference">รหัสอ้างอิง: {submitError.reference}</p>}
                </div>
            )}

            <button className="button-primary" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting && <span className="spinner" aria-hidden="true" />}
                {isSubmitting ? 'กำลังดำเนินการ…' : TEXT[mode].submit}
            </button>
        </form>
    )
}
