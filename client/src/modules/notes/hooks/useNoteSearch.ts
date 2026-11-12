import { useCallback, useEffect, useState } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { searchNotes } from '../services/note-service'
import type { NoteSearchResult, SearchScope } from '../types/note'
import { appendResults } from '../utils/search/append-results'
import { toSearchQuery } from '../utils/search/search-query'
import { toSearchOptions } from '../utils/search/search-request'
import { createLatestRequestGate } from '../utils/shell/latest-request-gate'

const TYPING_PAUSE_MS = 300

/** What the screen shows for one query. Kept with its query, so an answer for older text is never shown for newer text */
type SearchState = {
    /** The query with the scope and the branch it was asked with */
    key: string
    /** undefined until the first page arrives (or fails) */
    items: NoteSearchResult[] | undefined
    hasMore: boolean
    /** Without items: the first page failed. With items: "load more" failed and the shown results stay */
    error: ApiError | undefined
    isLoadingMore: boolean
}

/** Searches the notes for the text in the box, after a pause in typing. The text and the branch are never logged, stored or put in a URL. A new scope or branch is a new search */
export function useNoteSearch(rawText: string, scope: SearchScope, parentId: string | undefined) {
    const query = toSearchQuery(rawText)
    const { parentId: filterId, inTrash } = toSearchOptions(scope, parentId)
    const key = JSON.stringify([query, filterId, inTrash])
    const [gate] = useState(createLatestRequestGate)
    const [state, setState] = useState<SearchState | undefined>(undefined)

    const loadFirstPage = useCallback(
        async (searched: string) => {
            const token = gate.begin()
            try {
                const page = await searchNotes(searched, 0, { parentId: filterId, inTrash })
                if (gate.isCurrent(token)) setState({ key, items: page.items, hasMore: page.hasMore, error: undefined, isLoadingMore: false })
            } catch (failure) {
                if (gate.isCurrent(token)) setState({ key, items: undefined, hasMore: false, error: toFailure(failure), isLoadingMore: false })
            }
        },
        [gate, key, filterId, inTrash],
    )

    useEffect(() => {
        if (query === undefined) return
        const timer = setTimeout(() => loadFirstPage(query), TYPING_PAUSE_MS)
        return () => {
            clearTimeout(timer)
            gate.cancel()
        }
    }, [query, gate, loadFirstPage])

    const current = query !== undefined && state?.key === key ? state : undefined

    const loadMore = useCallback(async () => {
        if (query === undefined || current?.items === undefined || current.isLoadingMore) return
        const shown = current.items
        const token = gate.begin()
        setState({ ...current, error: undefined, isLoadingMore: true })
        try {
            const page = await searchNotes(query, shown.length, { parentId: filterId, inTrash })
            if (gate.isCurrent(token)) setState({ key, items: appendResults(shown, page.items), hasMore: page.hasMore, error: undefined, isLoadingMore: false })
        } catch (failure) {
            if (gate.isCurrent(token)) setState({ key, items: shown, hasMore: current.hasMore, error: toFailure(failure), isLoadingMore: false })
        }
    }, [query, current, gate, key, filterId, inTrash])

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
