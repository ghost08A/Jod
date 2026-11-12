import { describe, expect, it, vi } from 'vitest'
import { createDeferredActions } from './deferred-action'

function setup() {
    const queue = new Map<number, () => void>()
    let nextHandle = 0
    const deferred = createDeferredActions({
        setTimer: (action) => {
            nextHandle += 1
            queue.set(nextHandle, action)
            return nextHandle
        },
        clearTimer: (handle) => queue.delete(handle as number),
    })
    // Note: runs what is queued now, like the next tick would
    const tick = () => [...queue.values()].forEach((action) => action())
    return { deferred, tick }
}

describe('createDeferredActions', () => {
    it('does not run before the next tick, then runs exactly once', () => {
        const { deferred, tick } = setup()
        const action = vi.fn()
        deferred.schedule('n', action)
        expect(action).not.toHaveBeenCalled()
        tick()
        expect(action).toHaveBeenCalledTimes(1)
    })

    it('a remount of the same note cancels the pending action', () => {
        const { deferred, tick } = setup()
        const action = vi.fn()
        deferred.schedule('n', action)
        deferred.cancel('n')
        tick()
        expect(action).not.toHaveBeenCalled()
    })

    it('cancelling another key changes nothing', () => {
        const { deferred, tick } = setup()
        const action = vi.fn()
        deferred.schedule('n', action)
        deferred.cancel('other')
        tick()
        expect(action).toHaveBeenCalledTimes(1)
    })

    it('scheduling again for the same key keeps only the latest action', () => {
        const { deferred, tick } = setup()
        const first = vi.fn()
        const second = vi.fn()
        deferred.schedule('n', first)
        deferred.schedule('n', second)
        tick()
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })
})
