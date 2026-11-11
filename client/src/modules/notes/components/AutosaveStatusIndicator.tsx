import type { AutosaveView } from '../utils/autosave/autosave-controller'
import type { AutosaveStatus } from '../utils/autosave/autosave-decisions'
import { describeSaveFailure } from '../utils/autosave/save-failure-message'

const STATUS_LABELS: Record<AutosaveStatus, string> = {
    idle: '',
    unsaved: 'ยังไม่บันทึก',
    saving: 'กำลังบันทึก',
    retrying: 'รอลองใหม่',
    saved: 'บันทึกแล้ว',
    failed: 'บันทึกไม่สำเร็จ',
    conflict: 'โน้ตนี้ถูกแก้จากที่อื่น',
}

type AutosaveStatusIndicatorProps = {
    view: AutosaveView
    /** Result of the last copy, shown so the user knows whether the clipboard holds the note */
    copyResult: 'copied' | 'refused' | undefined
    onRetry: () => void
    onCopy: () => void
}

/** The save status in the top right corner. "บันทึกแล้ว" comes only from the machine's 'saved', i.e. the latest text */
export function AutosaveStatusIndicator({ view, copyResult, onRetry, onCopy }: AutosaveStatusIndicatorProps) {
    const isFailed = view.status === 'failed' || view.hasRefetchFailed
    const label = view.hasRefetchFailed ? STATUS_LABELS.failed : STATUS_LABELS[view.status]

    const failure = view.status === 'failed' && view.failureReason ? describeSaveFailure(view.failureReason) : undefined
    // Note: copying is offered when retrying cannot help, so the text can be kept somewhere else
    const canCopy = failure !== undefined && !failure.canRetryHelp && !view.hasRefetchFailed

    let detail: string | undefined
    if (view.hasRefetchFailed) detail = 'ตรวจฉบับล่าสุดบนเซิร์ฟเวอร์ไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่'
    else if (failure) detail = failure.message
    else if (view.status === 'conflict') detail = 'สิ่งที่แก้ต่อจากนี้จะยังไม่ถูกบันทึก'
    else if (view.isTooLargeForKeepalive) detail = 'โน้ตใหญ่เกินกว่าจะบันทึกตอนซ่อนหรือปิดหน้า รอให้ขึ้นว่าบันทึกแล้วก่อนปิด'
    const reference = view.status === 'failed' && !view.hasRefetchFailed ? view.failureReason?.reference : undefined
    const isWarning = isFailed || view.status === 'conflict' || view.isTooLargeForKeepalive

    return (
        <div className="notes-autosave">
            <div className="notes-autosave-status" role="status" aria-atomic="true" data-warning={isWarning}>
                {label && <p className="notes-autosave-label">{label}</p>}
                {detail && <p>{detail}</p>}
                {reference && <p>รหัสอ้างอิง: {reference}</p>}
                {canCopy && copyResult === 'copied' && <p>คัดลอกเนื้อหาแล้ว</p>}
                {canCopy && copyResult === 'refused' && (
                    <p>เบราว์เซอร์ไม่อนุญาตให้คัดลอก เลือกข้อความในหน้าแล้วกด Ctrl+C (หรือกดค้างบนมือถือ) แทน</p>
                )}
            </div>
            {canCopy && (
                <button className="button-primary" type="button" onClick={onCopy}>
                    คัดลอกเนื้อหา
                </button>
            )}
            {isFailed && (
                <button className={canCopy ? 'notes-secondary-button' : 'button-primary'} type="button" onClick={onRetry}>
                    ลองใหม่
                </button>
            )}
        </div>
    )
}
