import { useCallback, useEffect, useState } from 'react'
import type { NoteListItem } from '../types/note'
import {
    EXPANDED_NOTES_STORAGE_KEY,
    parseExpandedIds,
    serializeExpandedIds,
    syncExpandedState,
    toggleExpandedId,
    type ExpandedState,
} from '../utils/tree/expanded-notes'

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
    const [state, setState] = useState<ExpandedState>(() => ({ expanded: readStored(), items: undefined, openNoteId: undefined, pathFor: undefined }))

    // Note: state adjusted while rendering; syncExpandedState gives back the same state once it has looked at this list and note
    const synced = syncExpandedState(state, items, openNoteId)
    if (synced !== state) setState(synced)

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
