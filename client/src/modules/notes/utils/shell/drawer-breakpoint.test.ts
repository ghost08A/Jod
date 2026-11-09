import { describe, expect, it } from 'vitest'
import { DRAWER_MAX_WIDTH_PX, isDrawerViewport } from './drawer-breakpoint'

describe('isDrawerViewport', () => {
    it('is a drawer exactly at the breakpoint width', () => {
        const isDrawer = isDrawerViewport(DRAWER_MAX_WIDTH_PX)

        expect(isDrawer).toBe(true)
    })

    it('is not a drawer one pixel above the breakpoint', () => {
        const isDrawer = isDrawerViewport(DRAWER_MAX_WIDTH_PX + 1)

        expect(isDrawer).toBe(false)
    })

    it('is a drawer on a small phone and not on a wide desktop', () => {
        expect(isDrawerViewport(320)).toBe(true)
        expect(isDrawerViewport(1440)).toBe(false)
    })

    it('uses 768 as the breakpoint, the value written in notes.css', () => {
        expect(DRAWER_MAX_WIDTH_PX).toBe(768)
    })
})
