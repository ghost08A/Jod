import { useSyncExternalStore, type MouseEvent } from 'react'

function subscribeToVisualViewport(onChange: () => void) {
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', onChange)
    viewport?.addEventListener('scroll', onChange)
    return () => {
        viewport?.removeEventListener('resize', onChange)
        viewport?.removeEventListener('scroll', onChange)
    }
}

/** How far the on-screen keyboard reaches up from the bottom of the window (0 when it is closed) */
function readKeyboardHeight(): number {
    const viewport = window.visualViewport
    return viewport ? Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height) : 0
}

/** Keeps the caret in the editor: pressing a button must not move focus out of it */
function keepEditorFocus(event: MouseEvent) {
    event.preventDefault()
}

type MobileNestingToolbarProps = {
    canIndent: boolean
    canOutdent: boolean
    onIndent: () => void
    onOutdent: () => void
    onCreateChild: () => void
}

/** Tab, Shift+Tab and Shift+Enter as buttons, pinned above the on-screen keyboard. CSS shows it on narrow screens only */
export function MobileNestingToolbar(props: MobileNestingToolbarProps) {
    const keyboardHeight = useSyncExternalStore(subscribeToVisualViewport, readKeyboardHeight)
    const buttons = [
        { label: 'เยื้องเข้า', symbol: '⇥', isEnabled: props.canIndent, run: props.onIndent },
        { label: 'ถอยออก', symbol: '⇤', isEnabled: props.canOutdent, run: props.onOutdent },
        { label: 'บล็อกใหม่ข้างล่าง', symbol: '↳', isEnabled: true, run: props.onCreateChild },
    ]

    return (
        <div
            className="notes-nesting-toolbar"
            role="group"
            aria-label="จัดระดับบล็อก"
            style={{ bottom: keyboardHeight }}
            onMouseDown={keepEditorFocus}
        >
            {buttons.map((button) => (
                // Note: aria-disabled instead of disabled, so pressing a disabled button still cannot take focus away
                <button
                    key={button.label}
                    className="notes-icon-button"
                    type="button"
                    aria-label={button.label}
                    aria-disabled={!button.isEnabled}
                    onClick={() => {
                        if (button.isEnabled) button.run()
                    }}
                >
                    <span aria-hidden="true">{button.symbol}</span>
                </button>
            ))}
        </div>
    )
}
