/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string
    /** Google OAuth Client ID (not a secret) */
    readonly VITE_GOOGLE_CLIENT_ID?: string
}
