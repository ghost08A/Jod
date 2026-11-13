import { createContext } from 'react'
import type { ReferenceCardInfo } from '../types/note'

type ReferenceCardsValue = {
    /** undefined until the first answer */
    cards: ReadonlyMap<string, ReferenceCardInfo> | undefined
    hasFailed: boolean
}

/** Gives the cards inside the editor what useReferenceCards loaded, because the editor draws them outside the React tree of the page */
export const ReferenceCardsContext = createContext<ReferenceCardsValue>({ cards: undefined, hasFailed: false })
