import { describe, expect, it } from 'vitest'
import { toApiError, toConnectionError, toTimeoutError } from './api-error'

describe('toApiError', () => {
    it('prefers the specific messages in "errors" and keeps the reference', () => {
        const error = toApiError(409, {
            status: 409,
            title: 'ข้อมูลขัดแย้ง',
            detail: 'ข้อมูลขัดแย้งกับที่มีอยู่แล้ว',
            reference: 'AB23CD45',
            errors: ['อีเมลนี้มีบัญชีแล้ว'],
        })

        expect(error.status).toBe(409)
        expect(error.message).toBe('อีเมลนี้มีบัญชีแล้ว')
        expect(error.reference).toBe('AB23CD45')
    })

    it('joins several messages', () => {
        const error = toApiError(400, { errors: ['ข้อความหนึ่ง', 'ข้อความสอง'] })

        expect(error.message).toBe('ข้อความหนึ่ง ข้อความสอง')
    })

    it('falls back to detail when there is no "errors"', () => {
        const error = toApiError(500, { detail: 'ระบบขัดข้องชั่วคราว', reference: 'ZZ99AA11' })

        expect(error.message).toBe('ระบบขัดข้องชั่วคราว')
        expect(error.reference).toBe('ZZ99AA11')
    })

    it('ignores values of the wrong type', () => {
        const error = toApiError(400, { errors: [1, null, 'ใช้ได้'], detail: 5, reference: 7 })

        expect(error.message).toBe('ใช้ได้')
        expect(error.reference).toBeUndefined()
    })

    it('gives a generic Thai message when the body is not an object', () => {
        expect(toApiError(502, '<html>Bad gateway</html>').message).toBe('เกิดข้อผิดพลาด ลองอีกครั้ง')
        expect(toApiError(502, undefined).message).toBe('เกิดข้อผิดพลาด ลองอีกครั้ง')
    })
})

describe('toConnectionError', () => {
    it('tells the user to check the connection and has status 0', () => {
        const error = toConnectionError()

        expect(error.status).toBe(0)
        expect(error.message).toContain('เชื่อมต่อ')
    })
})

describe('toApiError extensions', () => {
    it('keeps unknown members of the body and leaves out the standard ones', () => {
        const error = toApiError(409, {
            type: 't',
            title: 'x',
            status: 409,
            detail: 'd',
            instance: '/i',
            reference: 'AB23CD45',
            errors: ['e'],
            currentNote: { id: 'n1' },
            other: 5,
        })

        expect(error.extensions).toEqual({ currentNote: { id: 'n1' }, other: 5 })
        expect(error.message).toBe('e')
        expect(error.reference).toBe('AB23CD45')
        expect(error.status).toBe(409)
    })

    it('has empty extensions when there is nothing extra or no object body', () => {
        expect(toApiError(400, { detail: 'd' }).extensions).toEqual({})
        expect(toApiError(502, 'html').extensions).toEqual({})
    })
})

describe('toTimeoutError', () => {
    it('is transient, status 408, unlike the connection error', () => {
        expect(toTimeoutError()).toMatchObject({ status: 408, transient: true })
        expect(toConnectionError().transient).toBe(false)
    })
})
