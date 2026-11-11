type ErrorMessageProps = {
    message: string | undefined
    reference?: string
    /** Which module's error styles to use (`notes-error` or `auth-error`) */
    styleScope: 'notes' | 'auth'
}

export function ErrorMessage({ message, reference, styleScope }: ErrorMessageProps) {
    return (
        <div className={`${styleScope}-error`} role="alert">
            <p>{message}</p>
            {reference && <p className={`${styleScope}-error-reference`}>รหัสอ้างอิง: {reference}</p>}
        </div>
    )
}
