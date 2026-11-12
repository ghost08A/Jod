import { describe, expect, it } from 'vitest'
import type { ReferenceCardInfo } from '../../types/note'
import type { NoteBlock, NoteDocument } from '../editor/block-document'
import { extractReferenceNoteIds, toReferenceCardView } from './reference-cards'

const documentOf = (blocks: NoteBlock[]): NoteDocument => ({ schemaVersion: 1, blocks })

describe('extractReferenceNoteIds', () => {
    it('returns the ids in reading order, at any depth, without repeats', () => {
        const document = documentOf([
            { id: 'a', type: 'reference', noteId: 'n1' },
            {
                id: 'b',
                type: 'toggle',
                text: '',
                children: [
                    { id: 'c', type: 'bullet', text: '', children: [{ id: 'd', type: 'reference', noteId: 'n2' }] },
                    { id: 'e', type: 'reference', noteId: 'n1' },
                ],
            },
            { id: 'f', type: 'paragraph', text: 'n3' },
        ])

        expect(extractReferenceNoteIds(document)).toEqual(['n1', 'n2'])
    })

    it('returns nothing for a document without cards', () => {
        expect(extractReferenceNoteIds(documentOf([{ id: 'a', type: 'paragraph', text: '' }]))).toEqual([])
    })
})

describe('toReferenceCardView', () => {
    const alive = (overrides: Partial<ReferenceCardInfo>): ReferenceCardInfo => ({
        noteId: 'n',
        status: 'alive',
        title: 'Plan',
        parentTitle: 'Work',
        placement: 'child',
        ...overrides,
    })

    it('shows the title and the parent for a child note', () => {
        expect(toReferenceCardView(alive({}))).toEqual({ titleLine: 'Plan', parentLine: 'Work', label: undefined, isClickable: true })
    })

    it('shows nothing under the title for a root note', () => {
        expect(toReferenceCardView(alive({ placement: 'root', parentTitle: null })).parentLine).toBeUndefined()
    })

    it('shows "รอจัดวาง" for an unplaced note', () => {
        expect(toReferenceCardView(alive({ placement: 'unplaced', parentTitle: null })).parentLine).toBe('รอจัดวาง')
    })

    it('falls back to Untitled for a blank title and a blank parent title', () => {
        const view = toReferenceCardView(alive({ title: '  ', parentTitle: '' }))

        expect(view.titleLine).toBe('Untitled')
        expect(view.parentLine).toBe('Untitled')
    })

    it('labels a trashed note and keeps it clickable', () => {
        const view = toReferenceCardView(alive({ status: 'trashed' }))

        expect(view.label).toBe('อยู่ใน Trash')
        expect(view.isClickable).toBe(true)
    })

    it('shows a missing note as gone and not clickable', () => {
        expect(toReferenceCardView({ noteId: 'n', status: 'missing', title: null, parentTitle: null, placement: null })).toEqual({
            titleLine: 'Note นี้ไม่มีแล้ว',
            parentLine: undefined,
            label: undefined,
            isClickable: false,
        })
    })
})
