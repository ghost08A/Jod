export class ApiError extends Error {
    readonly status: number
    /** Short code the user can quote to the administrator, found in the server log */
    readonly reference: string | undefined
    /** Members the server put next to the standard problem+json ones (for example the current Note in a 409), untouched */
    readonly extensions: Record<string, unknown>
    /** True when trying again later may work: the request timed out */
    readonly transient: boolean

    constructor(
        status: number,
        message: string,
        reference?: string,
        extensions: Record<string, unknown> = {},
        transient = false,
    ) {
        super(message)
        this.status = status
        this.reference = reference
        this.extensions = extensions
        this.transient = transient
    }
}

const CONNECTION_MESSAGE = 'เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'
const TIMEOUT_MESSAGE = 'ระบบตอบกลับช้าเกินไป ลองอีกครั้ง'
const UNKNOWN_MESSAGE = 'เกิดข้อผิดพลาด ลองอีกครั้ง'

const STANDARD_MEMBERS = new Set(['type', 'title', 'status', 'detail', 'instance', 'errors', 'reference'])

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
    const extensions = Object.fromEntries(Object.entries(body).filter(([name]) => !STANDARD_MEMBERS.has(name)))
    return new ApiError(status, message, reference, extensions)
}

/** The request never got an answer (offline, server down) */
export function toConnectionError(): ApiError {
    return new ApiError(0, CONNECTION_MESSAGE)
}

/** The server did not answer in time. Status 408 tells it apart from "no connection" (0) */
export function toTimeoutError(): ApiError {
    return new ApiError(408, TIMEOUT_MESSAGE, undefined, {}, true)
}
