type JodMarkProps = {
    className?: string
}

export function JodMark({ className }: JodMarkProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <rect width="24" height="24" rx="7" />
            <path d="M15 6.5v8.5a3.5 3.5 0 0 1-3.5 3.5H9" />
        </svg>
    )
}
