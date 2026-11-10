import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { useNote } from '../hooks/useNote'
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

    return (
        <article className="notes-page" key={note.id}>
            <NoteTitleField initialTitle={note.title} />
            <NoteContextField initialContext={note.context} />
            {/* Note: onDocumentChange is not passed yet; ticket #21 (autosave) connects it. Nothing is saved in this round */}
            <Suspense fallback={<NoteEditorSkeleton />}>
                <NoteEditor content={note.content} />
            </Suspense>
        </article>
    )
}
