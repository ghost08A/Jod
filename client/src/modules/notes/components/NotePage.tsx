import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { useAutosave } from '../hooks/useAutosave'
import { useNote } from '../hooks/useNote'
import type { Note } from '../types/note'
import { AutosaveStatusIndicator } from './AutosaveStatusIndicator'
import { NoteContextField } from './NoteContextField'
import { NoteTitleField } from './NoteTitleField'

// Note: TipTap is large, so the editor is a separate chunk loaded only when a note opens (the sign-in page never loads it).
// If the chunk cannot be downloaded (offline), the error below is shown instead of a blank page
const NoteEditor = lazy(() =>
    import('./NoteEditor').then(
        (module) => ({ default: module.NoteEditor }),
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
                <div className="notes-error" role="alert">
                    <p>{error?.message}</p>
                    {error?.reference && <p className="notes-error-reference">รหัสอ้างอิง: {error.reference}</p>}
                </div>
                <button className="button-primary" type="button" onClick={retry}>
                    ลองอีกครั้ง
                </button>
            </div>
        )
    }

    // Note: keyed by id, so another note starts with fresh fields, editor and autosave
    return <LoadedNotePage key={note.id} note={note} />
}

function LoadedNotePage({ note }: { note: Note }) {
    const { view, copyResult, editTitle, editContext, editContent, retry, copyContent } = useAutosave(note)
    const { loadedNote, loadedRevision } = view

    // Note: the fields and the editor read their text once. When a newer note came from the server (only while
    // nothing here was edited), the revision key opens them again with that text
    return (
        <article className="notes-page">
            <AutosaveStatusIndicator view={view} copyResult={copyResult} onRetry={retry} onCopy={copyContent} />
            <NoteTitleField key={`title-${loadedRevision}`} initialTitle={loadedNote.title} onTitleChange={editTitle} />
            <NoteContextField key={`context-${loadedRevision}`} initialContext={loadedNote.context} onContextChange={editContext} />
            <Suspense fallback={<NoteEditorSkeleton />}>
                <NoteEditor key={`editor-${loadedRevision}`} content={loadedNote.content} onDocumentChange={editContent} />
            </Suspense>
        </article>
    )
}
