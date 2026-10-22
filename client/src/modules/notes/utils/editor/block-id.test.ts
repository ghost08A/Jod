import { describe, expect, it } from 'vitest'
import type { NoteDocument } from './block-document'
import {
    findDuplicateBlockIds,
    generateBlockId,
    reissueAllBlockIds,
    reissueDuplicateBlockIds,
} from './block-id'

function makeSequentialIdGenerator(prefix = 'new-id-') {
    let counter = 0
    return () => {
        counter += 1
        return `${prefix}${counter}`
    }
}

describe('generateBlockId', () => {
    it('uses the provided id generator when passed', () => {
        const id = generateBlockId(() => 'fixed-id-1')

        expect(id).toBe('fixed-id-1')
    })
})

describe('findDuplicateBlockIds', () => {
    it('returns an empty list when all block ids are unique across nested levels', () => {
        const document: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'b-1', type: 'paragraph', text: 'one' },
                {
                    id: 'b-2',
                    type: 'toggle',
                    text: 'two',
                    children: [{ id: 'b-3', type: 'bullet', text: 'three', children: [] }],
                },
            ],
        }

        expect(findDuplicateBlockIds(document)).toEqual([])
    })

    it('detects duplicate ids across top-level and deeply nested blocks', () => {
        const document: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'dup-a', type: 'paragraph', text: 'first' },
                {
                    id: 'unique-1',
                    type: 'bullet',
                    text: 'parent',
                    children: [
                        { id: 'dup-a', type: 'paragraph', text: 'pasted copy' },
                        { id: 'dup-b', type: 'code', text: 'x = 1' },
                        {
                            id: 'unique-2',
                            type: 'toggle',
                            text: 'nested toggle',
                            children: [{ id: 'dup-b', type: 'divider' }],
                        },
                    ],
                },
            ],
        }

        expect(findDuplicateBlockIds(document)).toEqual(['dup-a', 'dup-b'])
    })
})

describe('reissueDuplicateBlockIds', () => {
    it('reissues ids only for the duplicate occurrences while keeping original and non-duplicate ids unchanged', () => {
        const document: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'id-1', type: 'paragraph', text: 'original first' },
                { id: 'id-2', type: 'heading', level: 2, text: 'stays id-2' },
                { id: 'id-1', type: 'paragraph', text: 'pasted duplicate of id-1' },
                {
                    id: 'id-3',
                    type: 'toggle',
                    text: 'toggle parent',
                    children: [
                        { id: 'id-2', type: 'quote', text: 'nested duplicate of id-2' },
                        { id: 'id-4', type: 'checklist', text: 'stays id-4', checked: true, children: [] },
                    ],
                },
            ],
        }
        const generateId = makeSequentialIdGenerator('fresh-')

        const result = reissueDuplicateBlockIds(document, generateId)

        expect(result.blocks[0]?.id).toBe('id-1')
        expect(result.blocks[1]?.id).toBe('id-2')
        expect(result.blocks[2]?.id).toBe('fresh-1')
        const toggle = result.blocks[3]
        expect(toggle?.id).toBe('id-3')
        if (toggle?.type === 'toggle') {
            expect(toggle.children[0]?.id).toBe('fresh-2')
            expect(toggle.children[1]?.id).toBe('id-4')
        }
        expect(findDuplicateBlockIds(result)).toEqual([])
    })

    it('skips generated ids that already exist later in the document', () => {
        const document: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'id-1', type: 'paragraph', text: 'first' },
                { id: 'id-1', type: 'paragraph', text: 'duplicate' },
                { id: 'later-id', type: 'paragraph', text: 'already exists later' },
            ],
        }
        const generatedQueue = ['later-id', 'truly-new-id']
        const generateId = () => generatedQueue.shift() ?? 'fallback'

        const result = reissueDuplicateBlockIds(document, generateId)

        expect(result.blocks.map((block) => block.id)).toEqual(['id-1', 'truly-new-id', 'later-id'])
    })

    it('assigns a new id when a block has an empty id', () => {
        const document: NoteDocument = {
            schemaVersion: 1,
            blocks: [{ id: '', type: 'paragraph', text: 'missing id' }],
        }

        const result = reissueDuplicateBlockIds(document, () => 'assigned-id')

        expect(result.blocks[0]?.id).toBe('assigned-id')
    })
})

describe('reissueAllBlockIds', () => {
    it('reissues a new id for every block and never reuses any original id', () => {
        const original: NoteDocument = {
            schemaVersion: 1,
            blocks: [
                { id: 'orig-1', type: 'heading', level: 1, text: 'Title' },
                {
                    id: 'orig-2',
                    type: 'bullet',
                    text: 'Item',
                    children: [
                        {
                            id: 'orig-3',
                            type: 'checklist',
                            text: 'Task',
                            checked: true,
                            children: [{ id: 'orig-4', type: 'code', text: 'const a = 1', language: 'ts' }],
                        },
                    ],
                },
                { id: 'orig-5', type: 'divider' },
            ],
        }
        // Note: generator intentionally returns an original id first to prove collisions are rejected
        const candidates = ['orig-3', 'copy-1', 'copy-2', 'copy-3', 'copy-4', 'copy-5']
        const generateId = () => candidates.shift() ?? 'fallback'

        const copy = reissueAllBlockIds(original, generateId)

        const originalIds = new Set(['orig-1', 'orig-2', 'orig-3', 'orig-4', 'orig-5'])
        const copyIds: string[] = []
        const first = copy.blocks[0]
        const second = copy.blocks[1]
        const third = copy.blocks[2]
        if (first) copyIds.push(first.id)
        if (second && second.type === 'bullet') {
            copyIds.push(second.id)
            const child = second.children[0]
            if (child && child.type === 'checklist') {
                copyIds.push(child.id)
                const grandChild = child.children[0]
                if (grandChild) copyIds.push(grandChild.id)
            }
        }
        if (third) copyIds.push(third.id)

        expect(copyIds).toEqual(['copy-1', 'copy-2', 'copy-3', 'copy-4', 'copy-5'])
        expect(copyIds.some((id) => originalIds.has(id))).toBe(false)
        expect(findDuplicateBlockIds(copy)).toEqual([])
    })
})
