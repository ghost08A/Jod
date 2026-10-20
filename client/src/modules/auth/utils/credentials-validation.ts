export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254

export type CredentialsMode = 'login' | 'register'
export type CredentialsErrors = { email?: string; password?: string }

/**
 * Quick checks before sending the form. The server checks everything again,
 * so this only saves the user a round trip for obvious mistakes.
 */
export function validateCredentials(
    mode: CredentialsMode,
    values: { email: string; password: string },
): CredentialsErrors {
    const errors: CredentialsErrors = {}
    const email = values.email.trim()

    if (email.length === 0) errors.email = 'กรุณากรอกอีเมล'
    else if (email.length > MAX_EMAIL_LENGTH || !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง'

    if (values.password.length === 0) errors.password = 'กรุณากรอกรหัสผ่าน'
    else if (mode === 'register' && values.password.length < MIN_PASSWORD_LENGTH)
        errors.password = `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`
    else if (mode === 'register' && values.password.length > MAX_PASSWORD_LENGTH)
        errors.password = `รหัสผ่านต้องยาวไม่เกิน ${MAX_PASSWORD_LENGTH} ตัวอักษร`

    return errors
}
