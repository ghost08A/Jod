import { useRef, useState, type DragEvent } from 'react'
import { ApiError, toApiError } from '../../../core/http/api-error'
import { placeNote } from '../services/note-service'
import type { NoteListItem } from '../types/note'
import { dropRequest, dropZoneAt, type DropZone } from '../utils/tree/note-drop'

export type DropNotice = { message: string; reference?: string }

/** Drag and drop of tree rows with the browser's own drag events. `onMoved` runs after a move worked; the list should refresh */
export function useNoteDrag(items: NoteListItem[] | undefined, onMoved: () => void) {
    const [draggedId, setDraggedId] = useState<string | undefined>(undefined)
    const [indicator, setIndicator] = useState<{ targetId: string; zone: DropZone } | undefined>(undefined)
    const [notice, setNotice] = useState<DropNotice | undefined>(undefined)
    // Note: the ref stops a second drop while a move is still running
    const isMovingRef = useRef(false)

    function zoneOf(event: DragEvent<HTMLElement>): DropZone {
        const rect = event.currentTarget.getBoundingClientRect()
        return dropZoneAt(rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5)
    }

    function clear() {
        setDraggedId(undefined)
        setIndicator(undefined)
    }

    function handleDragStart(event: DragEvent<HTMLElement>, noteId: string) {
        event.dataTransfer.effectAllowed = 'move'
        // Note: Firefox starts no drag without data
        event.dataTransfer.setData('text/plain', noteId)
        setNotice(undefined)
        setDraggedId(noteId)
    }

    function handleDragOver(event: DragEvent<HTMLElement>, targetId: string) {
        if (!items || !draggedId) return
        // Note: every row accepts the drop so a refused one can still explain itself on drop
        event.preventDefault()
        const isUnplacedTop = items.find((item) => item.id === targetId)?.placement === 'unplaced'
        const zone = isUnplacedTop ? 'inside' : zoneOf(event)
        const result = dropRequest(items, draggedId, targetId, zone)
        const next = result.ok && result.request ? { targetId, zone } : undefined
        event.dataTransfer.dropEffect = next ? 'move' : 'none'
        setIndicator((current) => (current?.targetId === next?.targetId && current?.zone === next?.zone ? current : next))
    }

    async function handleDrop(event: DragEvent<HTMLElement>, targetId: string) {
        event.preventDefault()
        event.stopPropagation()
        const movedId = draggedId
        clear()
        if (!items || !movedId || isMovingRef.current) return
        const result = dropRequest(items, movedId, targetId, zoneOf(event))
        if (!result.ok) {
            setNotice({ message: result.reason })
            return
        }
        if (!result.request) return
        isMovingRef.current = true
        try {
            await placeNote(movedId, result.request)
            onMoved()
        } catch (failure) {
            const error = failure instanceof ApiError ? failure : toApiError(0, undefined)
            setNotice({ message: error.message, reference: error.reference })
        } finally {
            isMovingRef.current = false
        }
    }

    return { draggedId, indicator, notice, clearNotice: () => setNotice(undefined), handleDragStart, handleDragOver, handleDrop, handleDragEnd: clear }
}
