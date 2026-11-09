import { describe, expect, it } from 'vitest'
import { createLatestRequestGate } from './latest-request-gate'

describe('createLatestRequestGate', () => {
    it('accepts the answer of the only request', () => {
        const gate = createLatestRequestGate()

        const token = gate.begin()

        expect(gate.isCurrent(token)).toBe(true)
    })

    it('ignores the answer of an earlier request once a newer one has begun', () => {
        const gate = createLatestRequestGate()
        const olderToken = gate.begin()

        const newerToken = gate.begin()

        expect(gate.isCurrent(olderToken)).toBe(false)
        expect(gate.isCurrent(newerToken)).toBe(true)
    })

    it('ignores every answer after cancel, including the newest request', () => {
        const gate = createLatestRequestGate()
        const token = gate.begin()

        gate.cancel()

        expect(gate.isCurrent(token)).toBe(false)
    })

    it('accepts a request that begins after a cancel', () => {
        const gate = createLatestRequestGate()
        const staleToken = gate.begin()
        gate.cancel()

        const freshToken = gate.begin()

        expect(gate.isCurrent(staleToken)).toBe(false)
        expect(gate.isCurrent(freshToken)).toBe(true)
    })

    it('keeps two gates independent', () => {
        const noteGate = createLatestRequestGate()
        const listGate = createLatestRequestGate()
        const noteToken = noteGate.begin()

        listGate.begin()
        listGate.cancel()

        expect(noteGate.isCurrent(noteToken)).toBe(true)
    })
})
