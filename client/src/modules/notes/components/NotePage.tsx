import { Link, useParams } from 'react-router'
import { useNote } from '../hooks/useNote'
import { NoteContextField } from './NoteContextField'
import { NoteTitleField } from './NoteTitleField'

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
            <p className="notes-body-placeholder">พื้นที่เนื้อหา จะเปิดใช้ในงานถัดไป</p>
        </article>
    )
}
