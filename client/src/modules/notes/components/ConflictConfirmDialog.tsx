import { useEffect, useRef, type ReactNode } from 'react'

type ConflictConfirmDialogProps = {
    title: string
    /** What would be lost, in plain words */
    children: ReactNode
    copyLabel: string
    /** Result of the last copy, so the user knows the clipboard holds the other version */
    copyMessage: string | undefined
    confirmLabel: string
    onCopy: () => void
    onConfirm: () => void
    onCancel: () => void
}

/** A modal question before a version is thrown away. The native dialog traps focus, closes on Escape and returns focus */
export function ConflictConfirmDialog({
    title,
    children,
    copyLabel,
    copyMessage,
    confirmLabel,
    onCopy,
    onConfirm,
    onCancel,
}: ConflictConfirmDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) dialog.showModal()
    }, [])

    return (
        <dialog ref={dialogRef} className="notes-conflict-dialog" aria-labelledby="notes-conflict-dialog-title" onClose={onCancel}>
            <h2 id="notes-conflict-dialog-title" className="notes-conflict-dialog-title">
                {title}
            </h2>
            <p>{children}</p>
            <div className="notes-conflict-dialog-copy">
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={onCopy}>
                    {copyLabel}
                </button>
                <p role="status">{copyMessage}</p>
            </div>
            <div className="notes-conflict-dialog-actions">
                <button className="button-primary notes-conflict-button" type="button" onClick={onConfirm}>
                    {confirmLabel}
                </button>
                <button className="notes-secondary-button notes-conflict-button" type="button" onClick={onCancel} autoFocus>
                    ยกเลิก
                </button>
            </div>
        </dialog>
    )
}
