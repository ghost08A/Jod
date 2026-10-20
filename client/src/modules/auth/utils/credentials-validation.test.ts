import { describe, expect, it } from 'vitest'
import { validateCredentials } from './credentials-validation'

const GOOD_PASSWORD = 'a-long-enough-password'

describe('validateCredentials', () => {
    it('accepts a valid sign-up', () => {
        expect(validateCredentials('register', { email: 'someone@example.com', password: GOOD_PASSWORD })).toEqual({})
    })

    it('ignores spaces around the email', () => {
        expect(validateCredentials('login', { email: '  someone@example.com  ', password: 'x' })).toEqual({})
    })

    it.each(['', '   '])('asks for the email when it is empty (%j)', (email) => {
        expect(validateCredentials('login', { email, password: 'x' }).email).toBe('กรุณากรอกอีเมล')
    })

    it.each(['not-an-email', 'a@b', '@example.com', 'a b@example.com'])('rejects the email %j', (email) => {
        expect(validateCredentials('login', { email, password: 'x' }).email).toBe('รูปแบบอีเมลไม่ถูกต้อง')
    })

    it('rejects an email longer than 254 characters', () => {
        const email = `${'a'.repeat(250)}@example.com`

        expect(validateCredentials('register', { email, password: GOOD_PASSWORD }).email).toBe('รูปแบบอีเมลไม่ถูกต้อง')
    })

    it('asks for the password when it is empty, in both modes', () => {
        expect(validateCredentials('login', { email: 'a@example.com', password: '' }).password).toBe('กรุณากรอกรหัสผ่าน')
        expect(validateCredentials('register', { email: 'a@example.com', password: '' }).password).toBe('กรุณากรอกรหัสผ่าน')
    })

    it('enforces the password length only when signing up', () => {
        const email = 'a@example.com'

        expect(validateCredentials('register', { email, password: 'x'.repeat(9) }).password).toBe(
            'รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร',
        )
        expect(validateCredentials('register', { email, password: 'x'.repeat(10) }).password).toBeUndefined()
        expect(validateCredentials('register', { email, password: 'x'.repeat(128) }).password).toBeUndefined()
        expect(validateCredentials('register', { email, password: 'x'.repeat(129) }).password).toBe(
            'รหัสผ่านต้องยาวไม่เกิน 128 ตัวอักษร',
        )
        // an existing account may have a password that is checked only by the server
        expect(validateCredentials('login', { email, password: 'short' }).password).toBeUndefined()
    })

    it('reports both fields at once', () => {
        expect(validateCredentials('register', { email: '', password: '' })).toEqual({
            email: 'กรุณากรอกอีเมล',
            password: 'กรุณากรอกรหัสผ่าน',
        })
    })
})
