import { describe, expect, it } from 'vitest'
import {
    filterAndRankSlashCommands,
    SLASH_COMMAND_ITEMS,
    type SlashCommandItem,
} from './slash-commands'

describe('SLASH_COMMAND_ITEMS', () => {
    it('contains only the 11 commands in scope for 1b and excludes out-of-scope commands', () => {
        const commands = SLASH_COMMAND_ITEMS.map((item) => item.command)

        expect(commands).toEqual([
            '/text',
            '/h1',
            '/h2',
            '/h3',
            '/bullet',
            '/numbered',
            '/todo',
            '/quote',
            '/divider',
            '/code',
            '/toggle',
        ])
    })
})

describe('filterAndRankSlashCommands', () => {
    it('returns all 11 commands in default order when query is empty or just "/"', () => {
        expect(filterAndRankSlashCommands('')).toHaveLength(11)
        expect(filterAndRankSlashCommands('/')).toEqual(SLASH_COMMAND_ITEMS)
    })

    it('ranks "/h1" with Heading 1 first', () => {
        const results = filterAndRankSlashCommands('/h1')

        expect(results[0]?.command).toBe('/h1')
        expect(results[0]?.headingLevel).toBe(1)
    })

    it('ranks exact command name match above an earlier item whose keyword or description contains the query (prototype 022 F-1 rule)', () => {
        const customCommands: SlashCommandItem[] = [
            {
                name: 'text',
                command: '/text',
                blockType: 'paragraph',
                category: 'text-and-structure',
                title: 'Text mentioning code and h1',
                description: 'Includes keyword code and h1 in description',
                keywords: ['code', 'h1', 'toggle'],
            },
            ...SLASH_COMMAND_ITEMS.filter((item) => item.name !== 'text'),
        ]

        expect(filterAndRankSlashCommands('/code', customCommands)[0]?.command).toBe('/code')
        expect(filterAndRankSlashCommands('/h1', customCommands)[0]?.command).toBe('/h1')
        expect(filterAndRankSlashCommands('/toggle', customCommands)[0]?.command).toBe('/toggle')
    })

    it('ranks commands starting with "h" (/h1, /h2, /h3) before commands that only match "h" in keywords or description (prototype 022 round 2)', () => {
        const results = filterAndRankSlashCommands('/h')

        expect(results.slice(0, 3).map((item) => item.command)).toEqual(['/h1', '/h2', '/h3'])
    })

    it('matches Thai titles and keywords', () => {
        const todoResults = filterAndRankSlashCommands('ติ๊ก')
        const dividerResults = filterAndRankSlashCommands('เส้นแบ่ง')

        expect(todoResults[0]?.command).toBe('/todo')
        expect(dividerResults[0]?.command).toBe('/divider')
    })

    it('returns an empty list when no command matches the query', () => {
        expect(filterAndRankSlashCommands('/nonexistent')).toEqual([])
    })
})
