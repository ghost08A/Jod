import type { GoogleAccountsId } from '../types/google-identity'

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const BUTTON_WIDTH = 320

let scriptPromise: Promise<GoogleAccountsId> | undefined
let credentialHandler: ((credential: string) => void) | undefined
let isInitialized = false

function loadScript(): Promise<GoogleAccountsId> {
    scriptPromise ??= new Promise<GoogleAccountsId>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = SCRIPT_URL
        script.async = true
        script.onload = () => {
            const identity = window.google?.accounts.id
            if (identity) resolve(identity)
            else reject(new Error('Google Identity Services did not start'))
        }
        script.onerror = () => {
            script.remove()
            reject(new Error('Google Identity Services could not be loaded'))
        }
        document.head.append(script)
    }).catch((error: unknown) => {
        // Note: forget the failure so a later visit to the page can try again
        scriptPromise = undefined
        throw error
    })
    return scriptPromise
}

/**
 * Draws Google's own sign-in button inside `parent`. When the user signs in, Google gives the page an
 * ID token (credential) and `onCredential` receives it. The token is passed on to the server untouched:
 * the page never reads it to decide who the user is.
 */
export async function renderGoogleSignInButton(
    parent: HTMLElement,
    clientId: string,
    onCredential: (credential: string) => void,
): Promise<void> {
    const identity = await loadScript()
    credentialHandler = onCredential

    // Note: Google warns when initialize runs twice, and this page is opened again after every sign-out
    if (!isInitialized) {
        identity.initialize({
            client_id: clientId,
            callback: (response) => {
                if (response.credential) credentialHandler?.(response.credential)
            },
        })
        isInitialized = true
    }

    identity.renderButton(parent, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: BUTTON_WIDTH,
        locale: 'th',
    })
}
