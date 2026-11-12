import { describe, expect, it } from 'vitest'
import { describeSaveFailure } from './save-failure-message'

describe('describeSaveFailure', () => {
    it('keeps the message and allows retry for failures that may pass later', () => {
        expect(describeSaveFailure({ kind: 'network', message: 'เชื่อมต่อไม่ได้' })).toEqual({
            message: 'เชื่อมต่อไม่ได้',
            canRetryHelp: true,
        })
        expect(describeSaveFailure({ kind: 'http', status: 503, message: 'ระบบขัดข้อง' }).canRetryHelp).toBe(true)
    })

    it('gives a Thai message per cause where retrying does not help', () => {
        expect(describeSaveFailure({ kind: 'http', status: 400, message: 'เนื้อหาของโน้ตใหญ่เกินกำหนด' })).toEqual({
            message: 'เซิร์ฟเวอร์ไม่รับเนื้อหานี้: เนื้อหาของโน้ตใหญ่เกินกำหนด',
            canRetryHelp: false,
        })
        expect(describeSaveFailure({ kind: 'http', status: 403, message: 'x' })).toEqual({
            message: 'ไม่มีสิทธิ์บันทึกโน้ตนี้',
            canRetryHelp: false,
        })
        expect(describeSaveFailure({ kind: 'http', status: 413, message: 'x' }).message).toContain('ใหญ่เกิน')
        expect(describeSaveFailure({ kind: 'http', status: 401, message: 'x' }).message).toContain('เข้าสู่ระบบใหม่')
        expect(describeSaveFailure({ kind: 'http', status: 404, message: 'x' }).message).toContain('ไม่พบโน้ตนี้')
        expect(describeSaveFailure({ kind: 'http', status: 422, message: 'ข้อความจากเซิร์ฟเวอร์' })).toEqual({
            message: 'ข้อความจากเซิร์ฟเวอร์',
            canRetryHelp: false,
        })
    })

    it('tells a 404 may be a deleted note and offers the copy button, not retry', () => {
        expect(describeSaveFailure({ kind: 'http', status: 404, message: 'x' })).toEqual({
            message: 'ไม่พบโน้ตนี้ อาจถูกลบไปแล้ว ดูใน Trash',
            canRetryHelp: false,
        })
    })
})
