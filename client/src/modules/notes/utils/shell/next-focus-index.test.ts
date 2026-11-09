import { describe, expect, it } from 'vitest'
import { nextFocusIndex } from './next-focus-index'

describe('nextFocusIndex', () => {
    it('moves to the next element on Tab', () => {
        const next = nextFocusIndex(4, 1, false)

        expect(next).toBe(2)
    })

    it('wraps from the last element to the first on Tab', () => {
        const next = nextFocusIndex(4, 3, false)

        expect(next).toBe(0)
    })

    it('moves to the previous element on Shift+Tab', () => {
        const next = nextFocusIndex(4, 2, true)

        expect(next).toBe(1)
    })

    it('wraps from the first element to the last on Shift+Tab', () => {
        const next = nextFocusIndex(4, 0, true)

        expect(next).toBe(3)
    })

    it('goes to the first element on Tab when focus is outside the drawer', () => {
        const next = nextFocusIndex(4, -1, false)

        expect(next).toBe(0)
    })

    it('goes to the last element on Shift+Tab when focus is outside the drawer', () => {
        const next = nextFocusIndex(4, -1, true)

        expect(next).toBe(3)
    })

    it('stays on the only element', () => {
        expect(nextFocusIndex(1, 0, false)).toBe(0)
        expect(nextFocusIndex(1, 0, true)).toBe(0)
    })

    it('returns -1 when the drawer has nothing to focus', () => {
        const next = nextFocusIndex(0, -1, false)

        expect(next).toBe(-1)
    })
})
