export type HeadingLevel = 1 | 2 | 3

export type ParagraphBlock = {
    id: string
    type: 'paragraph'
    text: string
}

export type HeadingBlock = {
    id: string
    type: 'heading'
    level: HeadingLevel
    text: string
}

export type QuoteBlock = {
    id: string
    type: 'quote'
    text: string
}

export type CodeBlock = {
    id: string
    type: 'code'
    text: string
    language?: string
}

export type DividerBlock = {
    id: string
    type: 'divider'
}

export type BulletBlock = {
    id: string
    type: 'bullet'
    text: string
    children: NoteBlock[]
}

export type NumberedBlock = {
    id: string
    type: 'numbered'
    text: string
    children: NoteBlock[]
}

export type ChecklistBlock = {
    id: string
    type: 'checklist'
    text: string
    checked: boolean
    children: NoteBlock[]
}

export type ToggleBlock = {
    id: string
    type: 'toggle'
    text: string
    children: NoteBlock[]
}

export type ContainerBlock = BulletBlock | NumberedBlock | ChecklistBlock | ToggleBlock

export type LeafBlock = ParagraphBlock | HeadingBlock | QuoteBlock | CodeBlock | DividerBlock

export type NoteBlock = LeafBlock | ContainerBlock

export type NoteBlockType = NoteBlock['type']

export type NoteDocument = {
    schemaVersion: 1
    blocks: NoteBlock[]
}

export function isContainerBlock(block: NoteBlock): block is ContainerBlock {
    return (
        block.type === 'bullet' ||
        block.type === 'numbered' ||
        block.type === 'checklist' ||
        block.type === 'toggle'
    )
}

export function createEmptyNoteDocument(
    generateId: () => string = () => crypto.randomUUID(),
): NoteDocument {
    return {
        schemaVersion: 1,
        blocks: [
            {
                id: generateId(),
                type: 'paragraph',
                text: '',
            },
        ],
    }
}
