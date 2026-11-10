import { describe, expect, it } from 'vitest'
import { isSlashTriggerAllowed } from './slash-trigger'

describe('isSlashTriggerAllowed', () => {
    it('opens the menu for a "/" at the start of a line', () => {
        expect(isSlashTriggerAllowed('')).toBe(true)
    })

    it('opens the menu for a "/" after a space, a tab or a line break', () => {
        expect(isSlashTriggerAllowed('ข้อความ ')).toBe(true)
        expect(isSlashTriggerAllowed('a\t')).toBe(true)
        expect(isSlashTriggerAllowed('a\n')).toBe(true)
    })

    it('keeps a "/" inside a URL or right after another character as plain text', () => {
        expect(isSlashTriggerAllowed('https:')).toBe(false)
        expect(isSlashTriggerAllowed('https:/')).toBe(false)
        expect(isSlashTriggerAllowed('see https://a.b')).toBe(false)
        expect(isSlashTriggerAllowed('a')).toBe(false)
        expect(isSlashTriggerAllowed('ไทย')).toBe(false)
    })
})
