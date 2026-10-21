import {
    type HeadingLevel,
    type NoteBlock,
    type NoteDocument,
} from './block-document'
import { defaultGenerateBlockId, type IdGenerator } from './block-id'

export type TipTapNode = {
    type: string
    attrs?: Record<string, unknown>
    content?: TipTapNode[]
    text?: string
}

export type TipTapDocument = {
    type: 'doc'
    content: TipTapNode[]
}

function makeTextContent(text: string): TipTapNode[] {
    return text.length > 0 ? [{ type: 'text', text }] : []
}

function makeParagraphWithText(text: string, id?: string): TipTapNode {
    const content = makeTextContent(text)
    return {
        type: 'paragraph',
        ...(id !== undefined ? { attrs: { id } } : {}),
        ...(content.length > 0 ? { content } : {}),
    }
}

function isListItemBlock(
    block: NoteBlock | undefined,
): block is Extract<NoteBlock, { type: 'bullet' | 'numbered' | 'checklist' }> {
    return (
        block !== undefined &&
        (block.type === 'bullet' || block.type === 'numbered' || block.type === 'checklist')
    )
}

function listWrapperTypeFor(itemType: 'bullet' | 'numbered' | 'checklist'): string {
    switch (itemType) {
        case 'bullet':
            return 'bulletList'
        case 'numbered':
            return 'orderedList'
        case 'checklist':
            return 'taskList'
    }
}

function listItemNodeFor(
    block: Extract<NoteBlock, { type: 'bullet' | 'numbered' | 'checklist' }>,
): TipTapNode {
    const childNodes = convertBlocksToTipTapNodes(block.children)
    const content: TipTapNode[] = [makeParagraphWithText(block.text), ...childNodes]

    if (block.type === 'checklist') {
        return {
            type: 'taskItem',
            attrs: { id: block.id, checked: block.checked },
            content,
        }
    }

    return {
        type: 'listItem',
        attrs: { id: block.id },
        content,
    }
}

function convertSingleNonListBlock(block: NoteBlock): TipTapNode {
    switch (block.type) {
        case 'paragraph':
            return makeParagraphWithText(block.text, block.id)

        case 'heading': {
            const content = makeTextContent(block.text)
            return {
                type: 'heading',
                attrs: { id: block.id, level: block.level },
                ...(content.length > 0 ? { content } : {}),
            }
        }

        case 'quote':
            return {
                type: 'blockquote',
                attrs: { id: block.id },
                content: [makeParagraphWithText(block.text)],
            }

        case 'code': {
            const content = makeTextContent(block.text)
            return {
                type: 'codeBlock',
                attrs: { id: block.id, language: block.language ?? null },
                ...(content.length > 0 ? { content } : {}),
            }
        }

        case 'divider':
            return {
                type: 'horizontalRule',
                attrs: { id: block.id },
            }

        case 'toggle': {
            const summaryContent = makeTextContent(block.text)
            const detailsChildren = convertBlocksToTipTapNodes(block.children)
            // Note: Toggle open/closed state is UI-only and never stored in the document or converter attrs
            return {
                type: 'details',
                attrs: { id: block.id },
                content: [
                    {
                        type: 'detailsSummary',
                        ...(summaryContent.length > 0 ? { content: summaryContent } : {}),
                    },
                    {
                        type: 'detailsContent',
                        ...(detailsChildren.length > 0 ? { content: detailsChildren } : {}),
                    },
                ],
            }
        }

        case 'bullet':
        case 'numbered':
        case 'checklist':
            // Handled by convertBlocksToTipTapNodes grouping
            return {
                type: listWrapperTypeFor(block.type),
                content: [listItemNodeFor(block)],
            }
    }
}

function convertBlocksToTipTapNodes(blocks: readonly NoteBlock[]): TipTapNode[] {
    const nodes: TipTapNode[] = []
    let index = 0

    while (index < blocks.length) {
        const current = blocks[index]
        if (!current) break

        if (isListItemBlock(current)) {
            const listType = current.type
            const items: TipTapNode[] = []
            while (index < blocks.length) {
                const candidate = blocks[index]
                if (!isListItemBlock(candidate) || candidate.type !== listType) break
                items.push(listItemNodeFor(candidate))
                index += 1
            }
            nodes.push({
                type: listWrapperTypeFor(listType),
                content: items,
            })
        } else {
            nodes.push(convertSingleNonListBlock(current))
            index += 1
        }
    }

    return nodes
}

export function noteDocumentToTipTap(document: NoteDocument): TipTapDocument {
    return {
        type: 'doc',
        content: convertBlocksToTipTapNodes(document.blocks),
    }
}

function readPlainTextFromNode(node: TipTapNode | undefined): string {
    if (!node) return ''
    if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
    if (node.type === 'hardBreak') return '\n'
    if (!Array.isArray(node.content)) return ''
    return node.content.map(readPlainTextFromNode).join('')
}

function readParagraphsPlainText(nodes: readonly TipTapNode[]): string {
    return nodes.map(readPlainTextFromNode).join('\n')
}

function readBlockId(attrs: Record<string, unknown> | undefined, generateId: IdGenerator): string {
    const raw = attrs?.id
    if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw
    }
    return generateId()
}

function normalizeHeadingLevel(rawLevel: unknown): HeadingLevel {
    if (rawLevel === 1 || rawLevel === 2 || rawLevel === 3) {
        return rawLevel
    }
    return 1
}

function convertListItemNode(
    itemNode: TipTapNode,
    kind: 'bullet' | 'numbered' | 'checklist',
    generateId: IdGenerator,
): NoteBlock {
    const id = readBlockId(itemNode.attrs, generateId)
    const content = Array.isArray(itemNode.content) ? itemNode.content : []
    const firstChild = content[0]
    const hasLeadingParagraph = firstChild?.type === 'paragraph'
    const text = hasLeadingParagraph ? readPlainTextFromNode(firstChild) : ''
    const remainingNodes = hasLeadingParagraph ? content.slice(1) : content
    const children = convertTipTapNodesToBlocks(remainingNodes, generateId)

    if (kind === 'checklist') {
        const checked = itemNode.attrs?.checked === true
        return {
            id,
            type: 'checklist',
            text,
            checked,
            children,
        }
    }

    return {
        id,
        type: kind,
        text,
        children,
    }
}

function convertTipTapNodesToBlocks(
    nodes: readonly TipTapNode[] | undefined,
    generateId: IdGenerator,
): NoteBlock[] {
    if (!Array.isArray(nodes)) return []
    const blocks: NoteBlock[] = []

    for (const node of nodes) {
        switch (node.type) {
            case 'paragraph':
                blocks.push({
                    id: readBlockId(node.attrs, generateId),
                    type: 'paragraph',
                    text: readPlainTextFromNode(node),
                })
                break

            case 'heading':
                blocks.push({
                    id: readBlockId(node.attrs, generateId),
                    type: 'heading',
                    level: normalizeHeadingLevel(node.attrs?.level),
                    text: readPlainTextFromNode(node),
                })
                break

            case 'blockquote': {
                const inner = Array.isArray(node.content) ? node.content : []
                blocks.push({
                    id: readBlockId(node.attrs, generateId),
                    type: 'quote',
                    text: readParagraphsPlainText(inner),
                })
                break
            }

            case 'codeBlock': {
                const rawLanguage = node.attrs?.language
                const language =
                    typeof rawLanguage === 'string' && rawLanguage.trim().length > 0
                        ? rawLanguage
                        : undefined
                blocks.push({
                    id: readBlockId(node.attrs, generateId),
                    type: 'code',
                    text: readPlainTextFromNode(node),
                    ...(language !== undefined ? { language } : {}),
                })
                break
            }

            case 'horizontalRule':
                blocks.push({
                    id: readBlockId(node.attrs, generateId),
                    type: 'divider',
                })
                break

            case 'bulletList': {
                const items = Array.isArray(node.content) ? node.content : []
                for (const item of items) {
                    if (item.type === 'listItem') {
                        blocks.push(convertListItemNode(item, 'bullet', generateId))
                    }
                }
                break
            }

            case 'orderedList': {
                const items = Array.isArray(node.content) ? node.content : []
                for (const item of items) {
                    if (item.type === 'listItem') {
                        blocks.push(convertListItemNode(item, 'numbered', generateId))
                    }
                }
                break
            }

            case 'taskList': {
                const items = Array.isArray(node.content) ? node.content : []
                for (const item of items) {
                    if (item.type === 'taskItem') {
                        blocks.push(convertListItemNode(item, 'checklist', generateId))
                    }
                }
                break
            }

            case 'details': {
                const inner: TipTapNode[] = Array.isArray(node.content) ? node.content : []
                const summaryNode = inner.find((child) => child.type === 'detailsSummary')
                const contentNode = inner.find((child) => child.type === 'detailsContent')
                const directChildren = inner.filter(
                    (child) => child.type !== 'detailsSummary' && child.type !== 'detailsContent',
                )
                const childSource = contentNode ? contentNode.content : directChildren
                // Note: Any open/closed attribute on details is intentionally ignored
                blocks.push({
                    id: readBlockId(node.attrs, generateId),
                    type: 'toggle',
                    text: readPlainTextFromNode(summaryNode),
                    children: convertTipTapNodesToBlocks(childSource, generateId),
                })
                break
            }
        }
    }

    return blocks
}

export function tipTapToNoteDocument(
    tipTapDocument: TipTapDocument,
    generateId: IdGenerator = defaultGenerateBlockId,
): NoteDocument {
    return {
        schemaVersion: 1,
        blocks: convertTipTapNodesToBlocks(tipTapDocument.content, generateId),
    }
}
