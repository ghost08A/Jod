import type { ConflictSide } from '../../types/conflict'

const SIDE_BY_KEY = new Map<string, ConflictSide>([
    ['ArrowLeft', 'mine'],
    ['ArrowUp', 'mine'],
    ['Home', 'mine'],
    ['ArrowRight', 'theirs'],
    ['ArrowDown', 'theirs'],
    ['End', 'theirs'],
])

/** WAI-ARIA tabs: the version a key moves to in the two-tab list, or undefined when the key does nothing */
export function sideForTabKey(key: string): ConflictSide | undefined {
    return SIDE_BY_KEY.get(key)
}
