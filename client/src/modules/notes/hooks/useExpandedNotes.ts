import { useCallback, useEffect, useState } from 'react'
import type { NoteListItem } from '../types/note'
import {
    EXPANDED_NOTES_STORAGE_KEY,
    expandIds,
    parseExpandedIds,
    pruneExpandedIds,
    serializeExpandedIds,
    toggleExpandedId,
} from '../utils/tree/expanded-notes'
import { noteAncestors } from '../utils/tree/note-ancestors'

// Note: the storage may be missing or blocked; the tree then simply forgets its state on reload
function readStored(): Set<string> {
    try {
        return parseExpandedIds(localStorage.getItem(EXPANDED_NOTES_STORAGE_KEY))
    } catch {
        return new Set()
    }
}

/**
 * Which branches are open. Remembered in this browser only (ids, never note text). Unknown ids are dropped when the list loads,
 * and the path to the open note is opened once per open note, so a branch the user closes afterwards stays closed
 */
export function useExpandedNotes(items: NoteListItem[] | undefined, openNoteId: string | undefined) {
    const [state, setState] = useState(() => ({ expanded: readStored(), items: undefined as NoteListItem[] | undefined, pathFor: undefined as string | undefined }))

    if (items && (state.items !== items || (openNoteId !== undefined && state.pathFor !== openNoteId))) {
        let expanded = pruneExpandedIds(state.expanded, items)
        let pathFor = state.pathFor
        // Note: an open note that is not in the list yet (just created) is tried again when the list arrives
        if (openNoteId !== undefined && pathFor !== openNoteId && items.some((item) => item.id === openNoteId)) {
            expanded = expandIds(expanded, noteAncestors(items, openNoteId).map((ancestor) => ancestor.id))
            pathFor = openNoteId
        }
        setState({ expanded, items, pathFor })
    }

    const { expanded } = state
    useEffect(() => {
        try {
            localStorage.setItem(EXPANDED_NOTES_STORAGE_KEY, serializeExpandedIds(expanded))
        } catch {
            // Note: nothing to do, see readStored
        }
    }, [expanded])

    const toggle = useCallback((id: string) => setState((previous) => ({ ...previous, expanded: toggleExpandedId(previous.expanded, id) })), [])
    return { expanded, toggle }
}
