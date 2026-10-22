import { isContainerBlock, type NoteBlock, type NoteDocument } from './block-document'

export type IdGenerator = () => string

export const defaultGenerateBlockId: IdGenerator = () => crypto.randomUUID()

export function generateBlockId(generateId: IdGenerator = defaultGenerateBlockId): string {
    return generateId()
}

function collectAllBlockIds(blocks: readonly NoteBlock[], target: Set<string>): void {
    for (const block of blocks) {
        target.add(block.id)
        if (isContainerBlock(block)) {
            collectAllBlockIds(block.children, target)
        }
    }
}

function drawUniqueId(reservedIds: Set<string>, generateId: IdGenerator): string {
    let candidate = generateId()
    while (!candidate || reservedIds.has(candidate)) {
        candidate = generateId()
    }
    reservedIds.add(candidate)
    return candidate
}

/**
 * Finds block ids that appear more than once in the document (in pre-order traversal).
 */
export function findDuplicateBlockIds(document: NoteDocument): string[] {
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    function walk(blocks: readonly NoteBlock[]): void {
        for (const block of blocks) {
            if (seen.has(block.id)) {
                duplicates.add(block.id)
            } else {
                seen.add(block.id)
            }
            if (isContainerBlock(block)) {
                walk(block.children)
            }
        }
    }

    walk(document.blocks)
    return Array.from(duplicates)
}

/**
 * Ensures every block in the document has a non-empty unique id.
 * The first occurrence of an id is preserved; subsequent duplicates (or empty ids)
 * receive a fresh id that does not collide with any existing id in the document.
 */
export function reissueDuplicateBlockIds(
    document: NoteDocument,
    generateId: IdGenerator = defaultGenerateBlockId,
): NoteDocument {
    const reservedIds = new Set<string>()
    collectAllBlockIds(document.blocks, reservedIds)
    const seenInWalk = new Set<string>()

    function walkBlock(block: NoteBlock): NoteBlock {
        const needsNewId = block.id.trim() === '' || seenInWalk.has(block.id)
        const nextId = needsNewId ? drawUniqueId(reservedIds, generateId) : block.id
        seenInWalk.add(nextId)

        if (!isContainerBlock(block)) {
            return nextId === block.id ? { ...block } : { ...block, id: nextId }
        }

        return {
            ...block,
            id: nextId,
            children: block.children.map(walkBlock),
        }
    }

    return {
        schemaVersion: 1,
        blocks: document.blocks.map(walkBlock),
    }
}

/**
 * Reissues a brand-new id for every block in the document (used when saving a copy in "keep both").
 * Guarantees that no new id matches any original id from the source document or another new id.
 */
export function reissueAllBlockIds(
    document: NoteDocument,
    generateId: IdGenerator = defaultGenerateBlockId,
): NoteDocument {
    const reservedIds = new Set<string>()
    collectAllBlockIds(document.blocks, reservedIds)

    function walkBlock(block: NoteBlock): NoteBlock {
        const nextId = drawUniqueId(reservedIds, generateId)

        if (!isContainerBlock(block)) {
            return { ...block, id: nextId }
        }

        return {
            ...block,
            id: nextId,
            children: block.children.map(walkBlock),
        }
    }

    return {
        schemaVersion: 1,
        blocks: document.blocks.map(walkBlock),
    }
}
