import { useCallback, useEffect, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { searchNotes } from '../services/note-service'
import type { NoteSearchResult } from '../types/note'
import { appendResults } from '../utils/search/append-results'
import { toSearchQuery } from '../utils/search/search-query'
import { createLatestRequestGate } from '../utils/shell/latest-request-gate'

const TYPING_PAUSE_MS = 300

/** What the screen shows for one query. Kept with its query, so an answer for older text is never shown for newer text */
type SearchState = {
    query: string
    /** undefined until the first page arrives (or fails) */
    items: NoteSearchResult[] | undefined
    hasMore: boolean
    /** Without items: the first page failed. With items: "load more" failed and the shown results stay */
    error: ApiError | undefined
    isLoadingMore: boolean
}

/** Searches the notes for the text in the box, after a pause in typing. The text is never logged, stored or put in a URL */
export function useNoteSearch(rawText: string) {
    const query = toSearchQuery(rawText)
    const [gate] = useState(createLatestRequestGate)
    const [state, setState] = useState<SearchState | undefined>(undefined)

    const loadFirstPage = useCallback(
        async (searched: string) => {
            const token = gate.begin()
            try {
                const page = await searchNotes(searched, 0)
                if (gate.isCurrent(token)) setState({ query: searched, items: page.items, hasMore: page.hasMore, error: undefined, isLoadingMore: false })
            } catch (failure) {
                if (gate.isCurrent(token)) {
                    setState({ query: searched, items: undefined, hasMore: false, error: toFailure(failure), isLoadingMore: false })
                }
            }
        },
        [gate],
    )

    useEffect(() => {
        if (query === undefined) return
        const timer = setTimeout(() => loadFirstPage(query), TYPING_PAUSE_MS)
        return () => {
            clearTimeout(timer)
            gate.cancel()
        }
    }, [query, gate, loadFirstPage])

    const current = query !== undefined && state?.query === query ? state : undefined

    const loadMore = useCallback(async () => {
        if (query === undefined || current?.items === undefined || current.isLoadingMore) return
        const shown = current.items
        const token = gate.begin()
        setState({ ...current, error: undefined, isLoadingMore: true })
        try {
            const page = await searchNotes(query, shown.length)
            if (gate.isCurrent(token)) setState({ query, items: appendResults(shown, page.items), hasMore: page.hasMore, error: undefined, isLoadingMore: false })
        } catch (failure) {
            if (gate.isCurrent(token)) setState({ query, items: shown, hasMore: current.hasMore, error: toFailure(failure), isLoadingMore: false })
        }
    }, [query, current, gate])

    const retry = useCallback(() => {
        if (query === undefined) return
        setState(undefined)
        loadFirstPage(query)
    }, [query, loadFirstPage])

    return {
        /** The trimmed text being searched; undefined means the sidebar shows the tree */
        query,
        items: current?.items,
        hasMore: current?.hasMore ?? false,
        error: current?.error,
        isLoadingMore: current?.isLoadingMore ?? false,
        isLoading: query !== undefined && current === undefined,
        loadMore,
        retry,
    }
}

function toFailure(failure: unknown): ApiError {
    return failure instanceof ApiError ? failure : toApiError(0, undefined)
}
