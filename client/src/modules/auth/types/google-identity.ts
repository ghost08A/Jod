/** What Google hands the page when the user picks an account. Only the ID token (credential) is used. */
export type GoogleCredentialResponse = {
    credential?: string
}

type GoogleButtonOptions = {
    type: 'standard'
    theme: 'outline' | 'filled_blue' | 'filled_black'
    size: 'large'
    text: 'signin_with'
    shape: 'rectangular'
    /** Pixels, Google allows 200 to 400 */
    width: number
    locale: string
}

// Note: only the parts of Google Identity Services this app calls, so no extra @types package is needed
export type GoogleAccountsId = {
    initialize: (configuration: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void
    renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
}

declare global {
    interface Window {
        google?: { accounts: { id: GoogleAccountsId } }
    }
}
