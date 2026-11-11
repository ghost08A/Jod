import { isTransientSaveFailure, type SaveFailureCause } from './retry-policy'

/**
 * The Thai message for a save that failed, and whether pressing retry can help.
 * When it cannot, the page also offers to copy the text out so nothing is lost.
 */
export function describeSaveFailure(failure: SaveFailureCause): { message: string; canRetryHelp: boolean } {
    if (isTransientSaveFailure(failure)) return { message: failure.message, canRetryHelp: true }
    if (failure.kind !== 'http') return { message: failure.message, canRetryHelp: false }

    switch (failure.status) {
        case 400:
            // Note: the server's 400 message already names the rule (too large, too deep, invalid) in Thai
            return { message: `เซิร์ฟเวอร์ไม่รับเนื้อหานี้: ${failure.message}`, canRetryHelp: false }
        case 401:
            return { message: 'เซสชันหมดอายุ คัดลอกเนื้อหาเก็บไว้ แล้วเข้าสู่ระบบใหม่', canRetryHelp: false }
        case 403:
            return { message: 'ไม่มีสิทธิ์บันทึกโน้ตนี้', canRetryHelp: false }
        case 404:
            return { message: 'ไม่พบโน้ตนี้แล้ว อาจถูกลบจากที่อื่น', canRetryHelp: false }
        case 413:
            return { message: 'โน้ตนี้ใหญ่เกินกว่าจะบันทึกได้ ลองแบ่งเป็นหลายโน้ต', canRetryHelp: false }
        default:
            return { message: failure.message, canRetryHelp: false }
    }
}
