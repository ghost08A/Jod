type Scheduler = {
    setTimer: (action: () => void) => unknown
    clearTimer: (handle: unknown) => void
}

const NEXT_TICK: Scheduler = {
    setTimer: (action) => setTimeout(action, 0),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * Runs an action on the next tick unless it is cancelled first. A React unmount that is followed at once by a
 * mount of the same page (StrictMode) cancels it, so only a real leave goes through. One pending action per key.
 */
export function createDeferredActions(scheduler: Scheduler = NEXT_TICK) {
    const pending = new Map<string, unknown>()

    function cancel(key: string) {
        if (!pending.has(key)) return
        scheduler.clearTimer(pending.get(key))
        pending.delete(key)
    }

    return {
        schedule(key: string, action: () => void) {
            cancel(key)
            pending.set(
                key,
                scheduler.setTimer(() => {
                    pending.delete(key)
                    action()
                }),
            )
        },
        cancel,
    }
}
