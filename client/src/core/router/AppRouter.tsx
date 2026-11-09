import { Navigate, Route, Routes } from 'react-router'
import { AccountPage } from '../../modules/auth/components/AccountPage'
import { LoginPage } from '../../modules/auth/components/LoginPage'
import { NotePage } from '../../modules/notes/components/NotePage'
import { NotesWorkspace } from '../../modules/notes/components/NotesWorkspace'
import { RequireAuth } from './RequireAuth'

export function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
                <Route path="/" element={<NotesWorkspace />}>
                    <Route index element={<p className="notes-empty-state">เลือกโน้ตหรือสร้างโน้ตใหม่</p>} />
                    <Route path="notes/:noteId" element={<NotePage />} />
                </Route>
                <Route path="/account" element={<AccountPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}
