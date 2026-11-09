/**
 * Where Tab should move inside a focus trap, given how many focusable elements the drawer holds and which one
 * has focus now (-1 when focus is outside the list). Returns -1 when there is nothing to focus.
 */
export function nextFocusIndex(focusableCount: number, currentIndex: number, isShiftKey: boolean): number {
    if (focusableCount === 0) return -1
    if (currentIndex < 0 || currentIndex >= focusableCount) return isShiftKey ? focusableCount - 1 : 0
    const step = isShiftKey ? -1 : 1
    return (currentIndex + step + focusableCount) % focusableCount
}
