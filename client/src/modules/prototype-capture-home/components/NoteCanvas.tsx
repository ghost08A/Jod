import { useLayoutEffect, useRef } from 'react'
import { DEFAULT_TITLE } from '../constants/seed-notes'
import { filterCommands, type SlashCommand } from '../constants/slash-commands'
import type { PrototypeNotesApi } from '../hooks/usePrototypeNotes'
import { useSlashMenu } from '../hooks/useSlashMenu'
import type { PrototypeNote } from '../types/prototype-note'
import { caretTop } from '../utils/caret-position'
import { displayTitle, notePath } from '../utils/note-label'
import { PlacementMenu } from './PlacementMenu'
import { SlashMenu, type SlashMenuStyle } from './SlashMenu'
import { SlashStepPanel } from './SlashStepPanel'

export interface SlashConfig {
    menuStyle: SlashMenuStyle
    // Note: 'now' = current rule (ticket 002); 'nameFirst' = proposal only, not a decision
    noteFlow: 'now' | 'nameFirst'
}

interface NoteCanvasProps {
    note: PrototypeNote
    api: PrototypeNotesApi
    slash: SlashConfig
    onToggleSidebar: () => void
}

// Note: one open surface - title and body live on the same canvas, no boxes, no footer
export function NoteCanvas({ note, api, slash, onToggleSidebar }: NoteCanvasProps) {
    const bodyRef = useRef<HTMLTextAreaElement>(null)
    const titleRef = useRef<HTMLInputElement>(null)
    const menu = useSlashMenu()
    const items = menu.trigger ? filterCommands(menu.trigger.query) : []

    useLayoutEffect(() => {
        const element = bodyRef.current
        if (!element) return
        element.style.height = 'auto'
        element.style.height = `${element.scrollHeight}px`
    }, [note.body])

    useLayoutEffect(() => {
        focusBodyEnd()
    }, [])

    function focusBodyEnd() {
        const element = bodyRef.current
        element?.focus()
        element?.setSelectionRange(element.value.length, element.value.length)
    }

    // Note: replaces "/query" with the inserted text, then puts the caret after it
    function insertAtTrigger(text: string, caretAt?: number) {
        const trigger = menu.trigger
        if (!trigger) return
        const end = trigger.start + 1 + trigger.query.length
        api.patch(note.id, { body: note.body.slice(0, trigger.start) + text + note.body.slice(end) })
        menu.close()
        window.requestAnimationFrame(() => {
            const element = bodyRef.current
            if (!element) return
            const position = trigger.start + (caretAt ?? text.length)
            element.focus()
            element.setSelectionRange(position, position)
        })
    }

    function createChild(name: string) {
        const title = name || DEFAULT_TITLE
        api.addChild(note.id, title)
        insertAtTrigger(`↗ ${title}`)
        api.notify(`สร้าง Note ลูก "${title}" ใต้ "${displayTitle(note)}" แล้ว และแทรกการ์ดไปหาแล้ว`)
    }

    function pick(item: SlashCommand) {
        if (item.kind === 'insert') insertAtTrigger(item.insert ?? '', item.caretAt)
        else if (item.kind === 'note' && slash.noteFlow === 'now') createChild('')
        else menu.setStep(item.kind === 'note' ? 'name' : item.kind)
    }

    return (
        <div className="pc-canvas">
            <header className="pc-topbar">
                <button type="button" className="pc-quiet pc-toggle" onClick={onToggleSidebar} aria-label="ซ่อน/แสดงแถบข้าง (Ctrl+\)">☰</button>
                <span className="pc-path">{notePath(api.notes, note)}</span>
                <PlacementMenu note={note} api={api} />
            </header>
            <div
                className="pc-page"
                onClick={(event) => {
                    if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('pc-column')) {
                        focusBodyEnd()
                    }
                }}
            >
                <div className="pc-column">
                    <input
                        ref={titleRef}
                        className="pc-title"
                        value={note.title}
                        placeholder={DEFAULT_TITLE}
                        onChange={(event) => api.patch(note.id, { title: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                bodyRef.current?.focus()
                            }
                        }}
                        aria-label="Title"
                    />
                    <textarea
                        ref={bodyRef}
                        className="pc-body"
                        value={note.body}
                        placeholder="กด '/' เพื่อดูคำสั่ง…"
                        onChange={(event) => {
                            const element = event.target
                            api.patch(note.id, { body: element.value })
                            menu.detect(element.value, element.selectionStart, () => caretTop(element, element.selectionStart))
                        }}
                        onKeyDown={(event) => {
                            const element = event.currentTarget
                            if (menu.trigger && !menu.step) {
                                if (event.key === 'ArrowDown') { event.preventDefault(); menu.setActive(Math.min(menu.active + 1, items.length - 1)); return }
                                if (event.key === 'ArrowUp') { event.preventDefault(); menu.setActive(Math.max(menu.active - 1, 0)); return }
                                if ((event.key === 'Enter' || event.key === 'Tab') && items[menu.active]) { event.preventDefault(); pick(items[menu.active]); return }
                                if (event.key === 'Escape') { event.preventDefault(); menu.close(); return }
                            }
                            if (event.key === 'ArrowUp' && element.selectionStart === 0 && element.selectionEnd === 0) {
                                event.preventDefault()
                                titleRef.current?.focus()
                            }
                        }}
                        onBlur={() => { if (!menu.step) menu.close() }}
                        aria-label="เนื้อหา"
                    />
                    {menu.trigger && (
                        <div
                            className={`pc-sm is-${slash.menuStyle}`}
                            style={slash.menuStyle === 'panel' ? undefined : { top: (bodyRef.current?.offsetTop ?? 0) + menu.trigger.top + 34 }}
                        >
                            {menu.step ? (
                                <SlashStepPanel
                                    step={menu.step}
                                    notes={api.notes}
                                    current={note}
                                    onCancel={() => { menu.close(); focusBodyEnd() }}
                                    onReference={(target) => {
                                        insertAtTrigger(`↗ ${displayTitle(target)}`)
                                        api.notify(`แทรกการ์ดไปหา "${displayTitle(target)}" แล้ว Note นั้นยังอยู่ที่เดิม ไม่ถูกย้าย`)
                                    }}
                                    onLink={(url) => insertAtTrigger(`🔗 ${url}`)}
                                    onName={createChild}
                                />
                            ) : (
                                <SlashMenu
                                    items={items}
                                    active={menu.active}
                                    menuStyle={slash.menuStyle}
                                    onPick={pick}
                                    onHover={menu.setActive}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
