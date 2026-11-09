// Note: the single breakpoint of the app. The same number is written in notes.css (@media max-width); change both together
export const DRAWER_MAX_WIDTH_PX = 768

/** At or below this width the sidebar is a drawer */
export function isDrawerViewport(viewportWidthPx: number): boolean {
    return viewportWidthPx <= DRAWER_MAX_WIDTH_PX
}
