const COPIED_STYLES = [
    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
    'padding-top', 'padding-left', 'padding-right', 'box-sizing', 'width',
]

// Note: measures the caret's vertical offset inside a textarea by mirroring its text in a hidden div
export function caretTop(element: HTMLTextAreaElement, caret: number): number {
    const style = window.getComputedStyle(element)
    const mirror = document.createElement('div')
    COPIED_STYLES.forEach((name) => mirror.style.setProperty(name, style.getPropertyValue(name)))
    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.overflowWrap = 'break-word'
    mirror.textContent = element.value.slice(0, caret)
    const marker = document.createElement('span')
    marker.textContent = '​'
    mirror.appendChild(marker)
    document.body.appendChild(mirror)
    const top = marker.offsetTop
    document.body.removeChild(mirror)
    return top
}
