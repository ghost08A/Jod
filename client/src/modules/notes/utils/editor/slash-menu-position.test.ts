import { describe, expect, it } from 'vitest'
import { selectSlashMenuLayout } from './slash-menu-position'

describe('selectSlashMenuLayout', () => {
    it('opens below the line when there is enough room below on a full screen (prototype 022 375x812 case)', () => {
        const layout = selectSlashMenuLayout({
            anchorTop: 248,
            anchorBottom: 274,
            viewportHeight: 812,
            contentHeight: 352,
        })

        expect(layout.side).toBe('below')
        expect(layout.maxHeight).toBe(320)
        expect(layout.isScrollable).toBe(true)
    })

    it('flips above the line and clamps height with scrolling when the mobile keyboard reduces space below (prototype 022 F-4 375x460 case)', () => {
        const layout = selectSlashMenuLayout({
            anchorTop: 248,
            anchorBottom: 274,
            viewportHeight: 460,
            contentHeight: 352,
        })

        expect(layout.side).toBe('above')
        expect(layout.maxHeight).toBeLessThanOrEqual(248 - 16)
        expect(layout.maxHeight).toBeGreaterThan(0)
        expect(layout.isScrollable).toBe(true)
    })

    it('is not scrollable when filtered items fit within the bounded height', () => {
        const layout = selectSlashMenuLayout({
            anchorTop: 248,
            anchorBottom: 274,
            viewportHeight: 460,
            contentHeight: 64,
        })

        expect(layout.isScrollable).toBe(false)
        expect(layout.maxHeight).toBeGreaterThanOrEqual(64)
    })

    it('stays below when space below is tight but still larger than space above (cursor near top of screen)', () => {
        const layout = selectSlashMenuLayout({
            anchorTop: 40,
            anchorBottom: 64,
            viewportHeight: 220,
            contentHeight: 300,
        })

        expect(layout.side).toBe('below')
        expect(layout.maxHeight).toBe(220 - 64 - 16)
        expect(layout.isScrollable).toBe(true)
    })
})
