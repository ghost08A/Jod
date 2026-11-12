import { createBrowserRouter, createRoutesFromElements, Navigate, Route, RouterProvider } from 'react-router'
import { AccountPage } from '../../modules/auth/components/AccountPage'
import { LoginPage } from '../../modules/auth/components/LoginPage'
import { NotePage } from '../../modules/notes/components/NotePage'
import { TrashPage } from '../../modules/notes/components/TrashPage'
import { NotesWorkspace } from '../../modules/notes/components/NotesWorkspace'
import { RequireAuth } from './RequireAuth'

// Note: a data router (not BrowserRouter) so the note page can use useBlocker to ask before leaving unsaved text
const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
                <Route path="/" element={<NotesWorkspace />}>
                    <Route index element={<p className="notes-empty-state">เลือกโน้ตหรือสร้างโน้ตใหม่</p>} />
                    <Route path="notes/:noteId" element={<NotePage />} />
                    <Route path="trash" element={<TrashPage />} />
                </Route>
                <Route path="/account" element={<AccountPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </>,
    ),
)

export function AppRouter() {
    return <RouterProvider router={router} />
}
