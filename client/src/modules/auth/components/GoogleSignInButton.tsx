import { useEffect, useRef } from 'react'
import { renderGoogleSignInButton } from '../services/google-identity'

type GoogleSignInButtonProps = {
    clientId: string
    onCredential: (credential: string) => void
    onLoadError: () => void
}

export function GoogleSignInButton({ clientId, onCredential, onLoadError }: GoogleSignInButtonProps) {
    const container = useRef<HTMLDivElement>(null)
    // Note: Google keeps the callback it was given the first time, so it gets a function that always reads the latest one
    const latestOnCredential = useRef(onCredential)

    useEffect(() => {
        latestOnCredential.current = onCredential
    }, [onCredential])

    useEffect(() => {
        const parent = container.current
        if (!parent) return
        let isCancelled = false
        renderGoogleSignInButton(parent, clientId, (credential) => latestOnCredential.current(credential)).catch(() => {
            if (!isCancelled) onLoadError()
        })
        return () => {
            isCancelled = true
        }
    }, [clientId, onLoadError])

    return <div ref={container} className="auth-google-button" />
}
