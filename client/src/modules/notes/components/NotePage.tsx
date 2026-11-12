import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import { useAutosave } from '../hooks/useAutosave'
import { useDiscardEmptyNote } from '../hooks/useDiscardEmptyNote'
import { useNote } from '../hooks/useNote'
import { useTrashList } from '../hooks/useTrashList'
import type { Note, NoteListItem } from '../types/note'
import { AutosaveStatusIndicator } from './AutosaveStatusIndicator'
import { Breadcrumb } from './Breadcrumb'
import { DeleteNoteDialog } from './DeleteNoteDialog'
import { MoveNoteDialog } from './MoveNoteDialog'
import { NewNoteButton } from './NewNoteButton'
import { NoteContextField } from './NoteContextField'
import { NoteTitleField } from './NoteTitleField'
import { TrashNoteActions } from './TrashNoteActions'
import { formatDateTimeMinutes } from '../utils/shell/format-date-time'

// Note: TipTap is large, so the editor is a separate chunk loaded only when a note opens (the sign-in page never loads it).
// If the chunk cannot be downloaded (offline), the error below is shown instead of a blank page
const NoteEditor = lazy(() =>
    import('./NoteEditor').then(
        (module) => ({ default: module.NoteEditor }),
        () => ({ default: NoteEditorLoadError }),
    ),
)

// Note: the conflict page holds two read-only editors, so it shares the editor chunk and is loaded only when a conflict happens
const ConflictPage = lazy(() =>
    import('./ConflictPage').then(
        (module) => ({ default: module.ConflictPage }),
        () => ({ default: NoteEditorLoadError }),
    ),
)

function NoteEditorLoadError() {
    return (
        <div className="notes-error" role="alert">
            <p>โหลดส่วนแก้ไขเนื้อหาไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง</p>
            {/* Note: a page reload is the reliable retry; some browsers keep a failed module import cached */}
            <button className="notes-secondary-button" type="button" onClick={() => window.location.reload()}>
                ลองอีกครั้ง
            </button>
        </div>
    )
}

function NoteEditorSkeleton() {
    return (
        <div className="notes-editor notes-editor-skeleton" role="status" aria-label="กำลังโหลด">
            <span className="skeleton" />
            <span className="skeleton" />
            <span className="skeleton notes-page-skeleton-body" />
        </div>
    )
}

export function NotePage() {
    // Note: the route /notes/:noteId always supplies the id
    const { noteId = '' } = useParams()
    const { note, error, isLoading, retry } = useNote(noteId)

    if (isLoading) {
        return (
            <div className="notes-page" role="status" aria-label="กำลังโหลด">
                <span className="skeleton notes-page-skeleton-title" />
                <span className="skeleton" />
                <span className="skeleton notes-page-skeleton-body" />
            </div>
        )
    }

    if (error?.status === 404) {
        return (
            <div className="notes-page">
                <p className="notes-page-message">ไม่พบโน้ตนี้</p>
                <Link to="/">กลับไปหน้าหลัก</Link>
            </div>
        )
    }

    if (error || !note) {
        return (
            <div className="notes-page">
                <ErrorMessage styleScope="notes" message={error?.message} reference={error?.reference} />
                <button className="button-primary" type="button" onClick={retry}>
                    ลองอีกครั้ง
                </button>
            </div>
        )
    }

    // Note: keyed by id, so another note starts with fresh fields, editor and autosave
    // Note: a deleted note never creates the autosave controller, so nothing can be sent for it
    return note.deletedAt === null ? <LoadedNotePage key={note.id} note={note} /> : <DeletedNotePage key={note.id} note={note} deletedAt={note.deletedAt} reloadNote={retry} />
}

function DeletedNotePage({ note, deletedAt, reloadNote }: { note: Note; deletedAt: string; reloadNote: () => void }) {
    const { refreshNoteList } = useOutletContext<{ refreshNoteList: () => void }>()
    const { items: trashItems } = useTrashList()
    const navigate = useNavigate()

    return (
        <article className="notes-page">
            <div className="notes-trash-banner" role="status">
                <span>โน้ตนี้อยู่ใน Trash (ลบเมื่อ {formatDateTimeMinutes(deletedAt)}) ดูได้อย่างเดียว</span>
                <Link to="/trash">กลับไป Trash</Link>
            </div>
            {/* Note: a restored note stays on screen: it is loaded again and, being alive now, opens as an editable page */}
            <TrashNoteActions
                noteId={note.id}
                items={trashItems}
                onRestored={() => {
                    refreshNoteList()
                    reloadNote()
                }}
                onDeleted={() => void navigate('/')}
                onGone={reloadNote}
            />
            <NoteTitleField initialTitle={note.title} isReadOnly />
            <NoteContextField initialContext={note.context} isReadOnly />
            <Suspense fallback={<NoteEditorSkeleton />}>
                <NoteEditor content={note.content} isReadOnly />
            </Suspense>
        </article>
    )
}

function LoadedNotePage({ note }: { note: Note }) {
    const { refreshNoteList, noteListItems } = useOutletContext<{ refreshNoteList: () => void; noteListItems: NoteListItem[] | undefined }>()
    const { view, readSavedState, copyResult, editTitle, editContext, editContent, retry, copyContent, conflict } = useAutosave(note, refreshNoteList)
    useDiscardEmptyNote(note.id, readSavedState, refreshNoteList)
    const { loadedNote, loadedRevision, conflictMyNote, conflictServerNote } = view
    const [isMoveOpen, setIsMoveOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const navigate = useNavigate()
    const isConflict = conflictMyNote !== undefined && conflictServerNote !== undefined

    // Note: the fields and the editor read their text once. When a newer note came from the server (only while
    // nothing here was edited), the revision key opens them again with that text
    return (
        <article className="notes-page" data-conflict={isConflict}>
            <AutosaveStatusIndicator view={view} copyResult={copyResult} onRetry={retry} onCopy={copyContent} />
            {isConflict && (
                <Suspense fallback={<NoteEditorSkeleton />}>
                    <ConflictPage
                        mine={conflictMyNote}
                        theirs={conflictServerNote}
                        isLimitReached={view.conflictLimitReached}
                        isResolving={view.isResolvingConflict}
                        copyResult={conflict.sideCopyResult}
                        keepBothState={conflict.keepBothState}
                        onCopy={conflict.copySide}
                        onKeepMine={conflict.keepMine}
                        onTakeTheirs={conflict.takeTheirs}
                        onKeepBoth={conflict.keepBoth}
                    />
                </Suspense>
            )}
            {/* Note: kept mounted but hidden during a conflict, so the fields keep their text and cannot be typed in */}
            <div className="notes-page-fields" hidden={isConflict}>
                <div className="notes-page-toolbar">
                    <Breadcrumb items={noteListItems} noteId={note.id} />
                    <button className="notes-secondary-button notes-page-move-button" type="button" onClick={() => setIsMoveOpen(true)} disabled={!noteListItems}>
                        จัดวาง
                    </button>
                    <button className="notes-secondary-button" type="button" onClick={() => setIsDeleteOpen(true)} disabled={!noteListItems}>
                        ลบ
                    </button>
                </div>
                <NewNoteButton parentId={note.id} onCreated={refreshNoteList} />
                <NoteTitleField key={`title-${loadedRevision}`} initialTitle={loadedNote.title} onTitleChange={editTitle} />
                <NoteContextField key={`context-${loadedRevision}`} initialContext={loadedNote.context} onContextChange={editContext} />
                <Suspense fallback={<NoteEditorSkeleton />}>
                    <NoteEditor key={`editor-${loadedRevision}`} content={loadedNote.content} onDocumentChange={editContent} />
                </Suspense>
            </div>
            {isMoveOpen && noteListItems && (
                <MoveNoteDialog noteId={note.id} items={noteListItems} onClose={() => setIsMoveOpen(false)} onMoved={refreshNoteList} />
            )}
            {isDeleteOpen && noteListItems && (
                <DeleteNoteDialog
                    noteId={note.id}
                    items={noteListItems}
                    onClose={() => setIsDeleteOpen(false)}
                    onDeleted={() => {
                        refreshNoteList()
                        void navigate('/')
                    }}
                />
            )}
        </article>
    )
}
