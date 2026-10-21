import { Navigate, Route, Routes } from 'react-router'
import { AccountPage } from '../../modules/auth/components/AccountPage'
import { LoginPage } from '../../modules/auth/components/LoginPage'
import { RequireAuth } from './RequireAuth'

export function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
                <Route path="/" element={<AccountPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
