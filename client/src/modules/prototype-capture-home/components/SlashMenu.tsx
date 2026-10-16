import { GROUP_LABEL, type SlashCommand } from '../constants/slash-commands'

export type SlashMenuStyle = 'grouped' | 'flat' | 'panel'

interface SlashMenuProps {
    items: SlashCommand[]
    active: number
    menuStyle: SlashMenuStyle
    onPick: (item: SlashCommand) => void
    onHover: (index: number) => void
}

export function SlashMenu({ items, active, menuStyle, onPick, onHover }: SlashMenuProps) {
    if (items.length === 0) return <div className="pc-sm-empty">ไม่พบคำสั่งที่ตรงกัน ลองพิมพ์คำอื่น หรือกด Esc</div>

    if (menuStyle === 'panel') {
        return (
            <div className="pc-sm-panel">
                {items.map((item, index) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`pc-sm-pill ${index === active ? 'is-active' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onPick(item)}
                    >
                        <span className="pc-sm-icon">{item.icon}</span>{item.title}
                    </button>
                ))}
            </div>
        )
    }

    return (
        <div className="pc-sm-list" role="listbox">
            {items.map((item, index) => (
                <div key={item.id}>
                    {menuStyle === 'grouped' && (index === 0 || items[index - 1].group !== item.group) && (
                        <div className="pc-sm-group">{GROUP_LABEL[item.group]}</div>
                    )}
                    <button
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={`pc-sm-item ${index === active ? 'is-active' : ''}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => onHover(index)}
                        onClick={() => onPick(item)}
                    >
                        <span className="pc-sm-icon">{item.icon}</span>
                        <span className="pc-sm-text">
                            <span><strong>{item.title}</strong> <span className="pc-sm-cmd">/{item.command}</span></span>
                            <span className="pc-sm-desc">{item.description}</span>
                        </span>
                    </button>
                </div>
            ))}
        </div>
    )
}
