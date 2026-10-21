export type SlashMenuSide = 'below' | 'above'

export type SlashMenuLayoutInput = {
    /** Top edge of the cursor line in viewport coordinates (px) */
    anchorTop: number
    /** Bottom edge of the cursor line in viewport coordinates (px) */
    anchorBottom: number
    /** Visible viewport height (already reduced when the mobile keyboard is open, e.g. visualViewport.height) */
    viewportHeight: number
    /** Natural height of the menu content before clamping (px) */
    contentHeight: number
    /** Maximum allowed height for the menu when space is plentiful (default 320px) */
    maxMenuHeight?: number
    /** Minimum gap between the anchor line and the menu, and between the menu and viewport edges (default 8px) */
    viewportMargin?: number
    /** Minimum space required below the line before flipping above when above has more room (default 180px) */
    minPreferredSpaceBelow?: number
}

export type SlashMenuLayout = {
    side: SlashMenuSide
    maxHeight: number
    isScrollable: boolean
}

const DEFAULT_MAX_MENU_HEIGHT = 320
const DEFAULT_VIEWPORT_MARGIN = 8
const DEFAULT_MIN_PREFERRED_SPACE_BELOW = 180

/**
 * Chooses whether the slash menu opens below or above the current line based on remaining
 * visible viewport space (including mobile virtual keyboard) and bounds its height so the
 * list never overflows off-screen and becomes scrollable when taller than available space.
 */
export function selectSlashMenuLayout(input: SlashMenuLayoutInput): SlashMenuLayout {
    const maxMenuHeight = input.maxMenuHeight ?? DEFAULT_MAX_MENU_HEIGHT
    const margin = input.viewportMargin ?? DEFAULT_VIEWPORT_MARGIN
    const minPreferredSpaceBelow = input.minPreferredSpaceBelow ?? DEFAULT_MIN_PREFERRED_SPACE_BELOW

    const spaceBelow = Math.max(0, input.viewportHeight - input.anchorBottom - margin * 2)
    const spaceAbove = Math.max(0, input.anchorTop - margin * 2)

    const requiredHeight = Math.min(input.contentHeight, maxMenuHeight)
    const fitsBelow = spaceBelow >= requiredHeight && spaceBelow >= minPreferredSpaceBelow

    const side: SlashMenuSide =
        fitsBelow || spaceBelow >= spaceAbove ? 'below' : 'above'

    const availableSpaceOnChosenSide = side === 'below' ? spaceBelow : spaceAbove
    const maxHeight = Math.max(0, Math.min(maxMenuHeight, availableSpaceOnChosenSide))
    const isScrollable = input.contentHeight > maxHeight

    return {
        side,
        maxHeight,
        isScrollable,
    }
}
