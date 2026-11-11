import { useRef, useState, type KeyboardEvent } from 'react'
import { ErrorMessage } from '../../../shared/components/ErrorMessage'
import type { ConflictSide } from '../hooks/useAutosave'
import type { NoteSnapshot } from '../utils/autosave/conflict-equivalence'
import { ConflictConfirmDialog } from './ConflictConfirmDialog'
import { NoteEditor } from './NoteEditor'

const SIDE_LABELS: Record<ConflictSide, string> = { mine: 'ฉบับในแท็บนี้', theirs: 'ฉบับอีกแท็บ' }
const SIDES: ConflictSide[] = ['mine', 'theirs']

type ConflictPageProps = {
    mine: NoteSnapshot
    theirs: NoteSnapshot
    /** "Use this version" collided 3 times in a row */
    isLimitReached: boolean
    copyResult: { side: ConflictSide; result: 'copied' | 'refused' } | undefined
    keepBothState: 'working' | 'failed' | undefined
    onCopy: (side: ConflictSide) => void
    onKeepMine: () => void
    onTakeTheirs: () => void
    onKeepBoth: () => void
}

function copyMessageFor(side: ConflictSide, copyResult: ConflictPageProps['copyResult']): string | undefined {
    if (copyResult?.side !== side) return undefined
    return copyResult.result === 'copied'
        ? `คัดลอก${SIDE_LABELS[side]}แล้ว`
        : 'เบราว์เซอร์ไม่อนุญาตให้คัดลอก เลือกข้อความในหน้าแล้วกด Ctrl+C (หรือกดค้างบนมือถือ) แทน'
}

/** Two versions of one note side by side (tabs on a narrow screen), read-only, and the three ways to settle it */
export function ConflictPage({
    mine,
    theirs,
    isLimitReached,
    copyResult,
    keepBothState,
    onCopy,
    onKeepMine,
    onTakeTheirs,
    onKeepBoth,
}: ConflictPageProps) {
    const [activeSide, setActiveSide] = useState<ConflictSide>('mine')
    const [confirming, setConfirming] = useState<ConflictSide | undefined>(undefined)
    const tabRefs = useRef<Partial<Record<ConflictSide, HTMLButtonElement | null>>>({})
    const isWorking = keepBothState === 'working'
    const versions: Record<ConflictSide, NoteSnapshot> = { mine, theirs }

    // Note: WAI-ARIA tabs: arrows (and Home/End) move between the two tabs; only the selected tab is in the Tab order
    function handleTabKeyDown(event: KeyboardEvent) {
        const nextSide = { ArrowLeft: 'mine', ArrowUp: 'mine', Home: 'mine', ArrowRight: 'theirs', ArrowDown: 'theirs', End: 'theirs' }[
            event.key
        ] as ConflictSide | undefined
        if (!nextSide) return
        event.preventDefault()
        setActiveSide(nextSide)
        tabRefs.current[nextSide]?.focus()
    }

    return (
        <section className="notes-conflict" aria-labelledby="notes-conflict-heading">
            <h1 id="notes-conflict-heading" className="notes-conflict-heading">
                โน้ตนี้ถูกแก้จากที่อื่น
            </h1>
            <p className="notes-conflict-intro">เลือกฉบับที่จะใช้ ยังไม่มีฉบับไหนถูกทิ้งจนกว่าจะกดยืนยัน</p>

            <div className="notes-conflict-tabs" role="tablist" aria-label="เลือกฉบับที่จะดู" onKeyDown={handleTabKeyDown}>
                {SIDES.map((side) => (
                    <button
                        key={side}
                        ref={(element) => {
                            tabRefs.current[side] = element
                        }}
                        id={`notes-conflict-tab-${side}`}
                        className="notes-conflict-tab"
                        type="button"
                        role="tab"
                        aria-selected={activeSide === side}
                        aria-controls={`notes-conflict-panel-${side}`}
                        tabIndex={activeSide === side ? 0 : -1}
                        onClick={() => setActiveSide(side)}
                    >
                        {SIDE_LABELS[side]}
                    </button>
                ))}
            </div>

            <div className="notes-conflict-sides">
                {SIDES.map((side) => (
                    <div
                        key={side}
                        id={`notes-conflict-panel-${side}`}
                        className="notes-conflict-side"
                        role="tabpanel"
                        aria-labelledby={`notes-conflict-side-heading-${side}`}
                        data-active={activeSide === side}
                    >
                        <div className="notes-conflict-side-header">
                            <h2 id={`notes-conflict-side-heading-${side}`} className="notes-conflict-side-heading">
                                {SIDE_LABELS[side]}
                            </h2>
                            <button className="notes-secondary-button notes-conflict-button" type="button" onClick={() => onCopy(side)}>
                                คัดลอก
                            </button>
                        </div>
                        <p role="status">{copyMessageFor(side, copyResult)}</p>
                        <p className="notes-conflict-title">{versions[side].title}</p>
                        {versions[side].context && <p className="notes-conflict-context">{versions[side].context}</p>}
                        <NoteEditor content={versions[side].content} isReadOnly />
                    </div>
                ))}
            </div>

            {isLimitReached && (
                <ErrorMessage
                    styleScope="notes"
                    message={'ฉบับในแท็บนี้ชนกับฉบับอีกแท็บซ้ำหลายครั้งแล้ว จึงหยุดลองให้ ถ้ายังต้องการเก็บข้อความนี้ ให้เลือก "เก็บทั้งสอง" หรือคัดลอกไว้ก่อน'}
                />
            )}
            {keepBothState === 'failed' && (
                <ErrorMessage styleScope="notes" message="สร้างโน้ตสำเนาไม่สำเร็จ ฉบับในแท็บนี้ยังอยู่ครบ ลองอีกครั้ง หรือคัดลอกไว้ก่อน" />
            )}

            <div className="notes-conflict-actions">
                <button
                    className="notes-secondary-button notes-conflict-button"
                    type="button"
                    onClick={() => setConfirming('mine')}
                    disabled={isWorking || isLimitReached}
                >
                    ใช้ฉบับนี้
                </button>
                <button
                    className="notes-secondary-button notes-conflict-button"
                    type="button"
                    onClick={() => setConfirming('theirs')}
                    disabled={isWorking}
                >
                    ใช้ฉบับอีกแท็บ
                </button>
                <button className="button-primary notes-conflict-button" type="button" onClick={onKeepBoth} disabled={isWorking} aria-busy={isWorking}>
                    {isWorking && <span className="spinner" aria-hidden="true" />}
                    {isWorking ? 'กำลังสร้างสำเนา…' : 'เก็บทั้งสอง'}
                </button>
            </div>

            {confirming === 'mine' && (
                <ConflictConfirmDialog
                    title="ใช้ฉบับนี้ทับฉบับอีกแท็บ?"
                    copyLabel="คัดลอกฉบับอีกแท็บ"
                    copyMessage={copyMessageFor('theirs', copyResult)}
                    confirmLabel="ใช้ฉบับนี้"
                    onCopy={() => onCopy('theirs')}
                    onConfirm={() => {
                        setConfirming(undefined)
                        onKeepMine()
                    }}
                    onCancel={() => setConfirming(undefined)}
                >
                    ฉบับอีกแท็บจะถูกแทนที่ด้วยฉบับในแท็บนี้ และเอากลับมาไม่ได้ ถ้ายังต้องการข้อความของฉบับอีกแท็บ ให้คัดลอกไว้ก่อน
                </ConflictConfirmDialog>
            )}
            {confirming === 'theirs' && (
                <ConflictConfirmDialog
                    title="ใช้ฉบับอีกแท็บ?"
                    copyLabel="คัดลอกฉบับในแท็บนี้"
                    copyMessage={copyMessageFor('mine', copyResult)}
                    confirmLabel="ใช้ฉบับอีกแท็บ"
                    onCopy={() => onCopy('mine')}
                    onConfirm={() => {
                        setConfirming(undefined)
                        onTakeTheirs()
                    }}
                    onCancel={() => setConfirming(undefined)}
                >
                    สิ่งที่แก้ในแท็บนี้จะหายไป และเอากลับมาไม่ได้ ถ้ายังต้องการข้อความนี้ ให้คัดลอกไว้ก่อน
                </ConflictConfirmDialog>
            )}
        </section>
    )
}
