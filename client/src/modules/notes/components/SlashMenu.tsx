import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import type { SlashMenuState } from '../utils/editor/slash-command-extension'
import { selectSlashMenuLayout } from '../utils/editor/slash-menu-position'
import type { SlashCommandCategory, SlashCommandItem } from '../utils/editor/slash-commands'

const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
    'text-and-structure': 'ข้อความและโครงสร้าง',
    'special-content': 'เนื้อหาพิเศษ',
}

// Note: the same gap that selectSlashMenuLayout keeps between the line, the menu and the screen edges
const MENU_GAP_PX = 8

type CommandGroup = {
    category: SlashCommandCategory
    entries: { item: SlashCommandItem; index: number }[]
}

/** Groups neighbouring commands of the same category, so the on-screen order stays the ranked order */
function groupByCategory(items: readonly SlashCommandItem[]): CommandGroup[] {
    const groups: CommandGroup[] = []
    items.forEach((item, index) => {
        const last = groups.at(-1)
        if (last?.category === item.category) last.entries.push({ item, index })
        else groups.push({ category: item.category, entries: [{ item, index }] })
    })
    return groups
}

/** Keeps the caret in the editor: pressing on the menu must not move focus out of it */
function keepEditorFocus(event: MouseEvent) {
    event.preventDefault()
}

type SlashMenuProps = {
    menu: SlashMenuState
    /** The listbox id; option ids are `${listId}-${command name}` */
    listId: string
}

export function SlashMenu({ menu, listId }: SlashMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const element = menuRef.current
        if (!element) return

        // Note: measured against the visual viewport, which shrinks when the on-screen keyboard opens
        const place = () => {
            const anchor = menu.clientRect?.()
            if (!anchor) return
            const viewport = window.visualViewport
            const viewportTop = viewport?.offsetTop ?? 0
            const contentHeight = element.scrollHeight
            const layout = selectSlashMenuLayout({
                anchorTop: anchor.top - viewportTop,
                anchorBottom: anchor.bottom - viewportTop,
                viewportHeight: viewport?.height ?? window.innerHeight,
                contentHeight,
            })
            const height = Math.min(contentHeight, layout.maxHeight)
            const top = layout.side === 'below' ? anchor.bottom + MENU_GAP_PX : anchor.top - MENU_GAP_PX - height
            const left = Math.min(anchor.left, window.innerWidth - element.offsetWidth - MENU_GAP_PX)
            element.style.maxHeight = `${layout.maxHeight}px`
            element.style.top = `${top}px`
            element.style.left = `${Math.max(MENU_GAP_PX, left)}px`
        }

        place()
        element.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
        const viewport = window.visualViewport
        viewport?.addEventListener('resize', place)
        viewport?.addEventListener('scroll', place)
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
            viewport?.removeEventListener('resize', place)
            viewport?.removeEventListener('scroll', place)
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
        }
    }, [menu])

    return (
        <div ref={menuRef} className="notes-slash-menu" onMouseDown={keepEditorFocus}>
            {menu.items.length === 0 ? (
                <p className="notes-slash-menu-empty" role="status">
                    ไม่พบคำสั่ง
                </p>
            ) : (
                <div id={listId} role="listbox" aria-label="คำสั่งสร้างบล็อก">
                    {groupByCategory(menu.items).map((group) => {
                        const headingId = `${listId}-group-${group.entries[0]?.index ?? 0}`
                        return (
                            <div key={headingId} role="group" aria-labelledby={headingId}>
                                <div id={headingId} className="notes-slash-menu-heading" role="presentation">
                                    {CATEGORY_LABELS[group.category]}
                                </div>
                                {group.entries.map(({ item, index }) => (
                                    <div
                                        key={item.name}
                                        id={`${listId}-${item.name}`}
                                        className="notes-slash-menu-option"
                                        role="option"
                                        aria-selected={index === menu.activeIndex}
                                        onClick={() => menu.select(index)}
                                    >
                                        <span className="notes-slash-menu-title">{item.title}</span>
                                        <span className="notes-slash-menu-description">
                                            {item.command} · {item.description}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
