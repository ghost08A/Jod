import { BrowserRouter } from 'react-router'
import { AuthProvider } from './core/providers/AuthProvider'
import { AppRouter } from './core/router/AppRouter'

export function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRouter />
            </AuthProvider>
        </BrowserRouter>
    )
}
