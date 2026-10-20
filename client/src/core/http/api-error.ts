export class ApiError extends Error {
    readonly status: number
    /** Short code the user can quote to the administrator, found in the server log */
    readonly reference: string | undefined

    constructor(status: number, message: string, reference?: string) {
        super(message)
        this.status = status
        this.reference = reference
    }
}

const CONNECTION_MESSAGE = 'เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'
const UNKNOWN_MESSAGE = 'เกิดข้อผิดพลาด ลองอีกครั้ง'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

/** Reads the application/problem+json the server sends for every error */
export function toApiError(status: number, body: unknown): ApiError {
    if (!isRecord(body)) return new ApiError(status, UNKNOWN_MESSAGE)

    const errors = Array.isArray(body.errors)
        ? body.errors.filter((item): item is string => typeof item === 'string')
        : []
    const detail = typeof body.detail === 'string' ? body.detail : undefined
    const reference = typeof body.reference === 'string' ? body.reference : undefined
    // Note: "errors" holds the specific message (for example "email already used"), detail is the generic one
    const message = errors.length > 0 ? errors.join(' ') : (detail ?? UNKNOWN_MESSAGE)
    return new ApiError(status, message, reference)
}

/** The request never got an answer (offline, server down) */
export function toConnectionError(): ApiError {
    return new ApiError(0, CONNECTION_MESSAGE)
}
