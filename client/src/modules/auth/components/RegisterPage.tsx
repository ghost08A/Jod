import { Link } from 'react-router'
import { CredentialsForm } from './CredentialsForm'
import './auth.css'

export function RegisterPage() {
    return (
        <main className="auth-page">
            <div className="auth-card">
                <h1>สมัครสมาชิก</h1>
                <CredentialsForm mode="register" />
                <p className="auth-switch">
                    มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
                </p>
            </div>
        </main>
    )
}
