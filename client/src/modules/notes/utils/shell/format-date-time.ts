const pad = (value: number) => String(value).padStart(2, '0')

/** "YYYY-MM-DD HH:mm" in the user's time zone; the text itself when the date cannot be read */
export function formatDateTimeMinutes(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
