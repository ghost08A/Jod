import { describe, expect, it } from 'vitest'
import { sideForTabKey } from './conflict-tab-keys'

describe('sideForTabKey', () => {
    it.each(['ArrowLeft', 'ArrowUp', 'Home'])('%s selects this tab version', (key) => {
        expect(sideForTabKey(key)).toBe('mine')
    })

    it.each(['ArrowRight', 'ArrowDown', 'End'])('%s selects the other tab version', (key) => {
        expect(sideForTabKey(key)).toBe('theirs')
    })

    it.each(['Enter', 'Tab', 'a', 'toString', 'constructor'])('ignores %s', (key) => {
        expect(sideForTabKey(key)).toBeUndefined()
    })
})
