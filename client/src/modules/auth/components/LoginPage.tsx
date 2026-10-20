import { Link } from 'react-router'
import { CredentialsForm } from './CredentialsForm'
import './auth.css'

export function LoginPage() {
    return (
        <main className="auth-page">
            <div className="auth-card">
                <h1>เข้าสู่ระบบ</h1>
                <CredentialsForm mode="login" />
                <p className="auth-switch">
                    ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
                </p>
            </div>
        </main>
    )
}
