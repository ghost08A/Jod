import { registerSessionSource } from '../../../core/http/http-client'
import type { SessionMessage } from '../types/auth-session'
import { createRefreshCoordinator } from '../utils/refresh-coordinator'
import { refreshSession } from './auth-service'

const LOCK_NAME = 'jod-refresh'
const CHANNEL_NAME = 'jod-session'

function isSessionMessage(data: unknown): data is SessionMessage {
    if (typeof data !== 'object' || data === null || !('type' in data)) return false
    return data.type === 'signedOut' || (data.type === 'session' && 'session' in data)
}

// BroadcastChannel only reaches pages of this same site, so the token never leaves this browser
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CHANNEL_NAME)

/** The one place the access token lives: in memory, never in localStorage or sessionStorage */
export const sessionCoordinator = createRefreshCoordinator({
    // Note: Web Locks make renewals take turns across tabs. Without them (very old browsers)
    // tabs cannot take turns, which is the best this can do.
    runExclusive: (work) => (navigator.locks ? navigator.locks.request(LOCK_NAME, work) : work()),
    requestRefresh: refreshSession,
    broadcast: (message) => channel?.postMessage(message),
    now: Date.now,
})

if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
        if (isSessionMessage(event.data)) sessionCoordinator.receive(event.data)
    }
}

registerSessionSource({
    getAccessToken: () => sessionCoordinator.getCurrent()?.accessToken,
    refresh: async (rejectedToken) => (await sessionCoordinator.refresh(rejectedToken))?.accessToken,
    onSessionLost: () => sessionCoordinator.forget(),
})
