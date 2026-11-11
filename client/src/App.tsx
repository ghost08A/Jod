import { AuthProvider } from './core/providers/AuthProvider'
import { AppRouter } from './core/router/AppRouter'

export function App() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    )
}
