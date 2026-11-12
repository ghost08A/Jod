import { describe, expect, it } from 'vitest'
import type { NoteBranch, NoteListItem, NotePlacement } from '../../types/note'
import { buildNoteTree } from './build-note-tree'

function note(id: string, placement: NotePlacement, parentId: string | null = null, position = 0): NoteListItem {
    return { id, title: id, updatedAt: '2026-01-01T00:00:00Z', placement, parentId, position }
}
const ids = (branches: NoteBranch[]) => branches.map((branch) => branch.item.id)

describe('buildNoteTree', () => {
    it('gives empty sections for an empty list', () => {
        expect(buildNoteTree([])).toEqual({ unplaced: [], root: [] })
    })

    it('keeps the list order for unplaced and orders root by position', () => {
        const tree = buildNoteTree([note('u2', 'unplaced'), note('r2', 'root', null, 2), note('u1', 'unplaced'), note('r1', 'root', null, 1)])
        expect(ids(tree.unplaced)).toEqual(['u2', 'u1'])
        expect(ids(tree.root)).toEqual(['r1', 'r2'])
    })

    it('hangs children under any parent by position, at any depth', () => {
        const tree = buildNoteTree([
            note('c2', 'child', 'u', 2),
            note('u', 'unplaced'),
            note('c1', 'child', 'u', 1),
            note('g', 'child', 'c1', 0),
        ])
        expect(ids(tree.unplaced)).toEqual(['u'])
        expect(ids(tree.unplaced[0].children)).toEqual(['c1', 'c2'])
        expect(ids(tree.unplaced[0].children[0].children)).toEqual(['g'])
    })

    it('shows a child with a missing parent as top-level unplaced', () => {
        const tree = buildNoteTree([note('o', 'child', 'gone'), note('r', 'root')])
        expect(ids(tree.unplaced)).toEqual(['o'])
        expect(ids(tree.root)).toEqual(['r'])
    })

    it('does not loop on a cycle and shows each note once', () => {
        const tree = buildNoteTree([note('a', 'child', 'b'), note('b', 'child', 'a'), note('s', 'child', 's')])
        const all: string[] = []
        const walk = (branches: NoteBranch[]) => {
            for (const branch of branches) {
                all.push(branch.item.id)
                walk(branch.children)
            }
        }
        walk(tree.unplaced)
        expect(all.sort()).toEqual(['a', 'b', 's'])
        expect(tree.root).toEqual([])
    })
})
