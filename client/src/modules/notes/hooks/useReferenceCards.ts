import { useCallback, useEffect, useMemo, useState } from 'react'
import { getReferenceCards } from '../services/note-service'
import type { ReferenceCardInfo } from '../types/note'
import { createLatestRequestGate } from '../utils/shell/latest-request-gate'

const MAX_CARDS_PER_REQUEST = 100

/**
 * Loads what every card of the open page shows, in one request. It loads again when the set of target notes changes
 * (a card was added or removed) and when the tab becomes visible again, so a rename or a move shows up.
 * Titles are never kept in the document or in any storage.
 */
export function useReferenceCards(noteIds: readonly string[]) {
    // Note: note ids are Guids, so a comma never appears inside one
    const key = noteIds.join(',')
    const [gate] = useState(createLatestRequestGate)
    const [cards, setCards] = useState<ReadonlyMap<string, ReferenceCardInfo>>()
    const [hasFailed, setHasFailed] = useState(false)

    // Note: .then like useNoteList and useNote, because the lint rule rejects an async load called from an effect
    const load = useCallback(() => {
        if (key.length === 0) return
        const token = gate.begin()
        const ids = key.split(',')
        const chunks = Array.from({ length: Math.ceil(ids.length / MAX_CARDS_PER_REQUEST) }, (_, index) =>
            ids.slice(index * MAX_CARDS_PER_REQUEST, (index + 1) * MAX_CARDS_PER_REQUEST),
        )
        Promise.all(chunks.map((chunk) => getReferenceCards(chunk)))
            .then((pages) => {
                if (!gate.isCurrent(token)) return
                setCards(new Map(pages.flatMap((page) => page.items).map((item) => [item.noteId, item])))
                setHasFailed(false)
            })
            .catch(() => {
                // Note: a failed reload keeps the cards already on screen
                if (gate.isCurrent(token)) setHasFailed(true)
            })
    }, [gate, key])

    useEffect(() => {
        load()
        return gate.cancel
    }, [gate, load])

    useEffect(() => {
        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [load])

    return useMemo(() => ({ cards, hasFailed }), [cards, hasFailed])
}
