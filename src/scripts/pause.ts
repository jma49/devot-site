import type { MediaQueryLike } from '../lib/dom-env.ts'

export const PAUSE_KEY = 'devot-site:pause-animations'
/** Set on the root element while animations are paused, for styles and tests. */
export const PAUSE_ATTRIBUTE = 'data-animations-paused'
const CHANGE = 'devot-site:pause-change'

export interface Pause {
  readonly paused: boolean
  set(paused: boolean): void
  /** Calls `listener` with each new state; returns a function that stops it. */
  subscribe(listener: (paused: boolean) => void): () => void
}

export interface PauseHost {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  /** Where copies of the state hear each other's changes. */
  events: EventTarget
  root: { toggleAttribute(name: string, force: boolean): boolean }
}

/**
 * The reader's choice to pause the page's clips and backdrop, remembered across visits. Each
 * script makes its own copy; a change through any of them reaches the rest through `events`, so
 * separately bundled scripts stay in step.
 */
export function createPause({ storage, events, root }: PauseHost): Pause {
  let paused = false
  try {
    paused = storage?.getItem(PAUSE_KEY) === 'true'
  } catch {
    // Storage the browser refuses leaves the page running; the choice then lasts the visit.
  }
  root.toggleAttribute(PAUSE_ATTRIBUTE, paused)
  const listeners = new Set<(paused: boolean) => void>()

  events.addEventListener(CHANGE, (event) => {
    const next = (event as CustomEvent<boolean>).detail
    if (next === paused) return
    paused = next
    listeners.forEach((listener) => listener(paused))
  })

  return {
    get paused() {
      return paused
    },
    set(next) {
      if (next === paused) return
      try {
        storage?.setItem(PAUSE_KEY, String(next))
      } catch {
        // As above: the choice still holds for this visit.
      }
      root.toggleAttribute(PAUSE_ATTRIBUTE, next)
      events.dispatchEvent(new CustomEvent(CHANGE, { detail: next }))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function browserPause(): Pause {
  let storage: Storage | null = null
  try {
    storage = window.localStorage
  } catch {
    // Reading `localStorage` itself throws where site data is blocked.
  }
  return createPause({ storage, events: document, root: document.documentElement })
}

type ChangeListener = (event: { matches: boolean }) => void

/**
 * A media query that matches while reduced motion is on or the reader has paused animations, for
 * scripts that already hold still under reduced motion.
 */
export function stillQuery(reduced: MediaQueryLike, pause: Pause): MediaQueryLike {
  const matches = () => reduced.matches || pause.paused
  const stops = new Map<ChangeListener, () => void>()
  const query = {
    get matches() {
      return matches()
    },
    addEventListener(_type: string, listener: unknown) {
      const notify = listener as ChangeListener
      if (stops.has(notify)) return
      let last = matches()
      const check = () => {
        if (matches() === last) return
        last = matches()
        notify({ matches: last })
      }
      reduced.addEventListener('change', check)
      const unsubscribe = pause.subscribe(check)
      stops.set(notify, () => {
        reduced.removeEventListener('change', check)
        unsubscribe()
      })
    },
    removeEventListener(_type: string, listener: unknown) {
      stops.get(listener as ChangeListener)?.()
      stops.delete(listener as ChangeListener)
    },
  }
  return query as unknown as MediaQueryLike
}

/** Keeps each toggle's `aria-pressed` on the pause state and flips the state when one is pressed. */
export function bindPauseToggles(toggles: Iterable<HTMLButtonElement>, pause: Pause): () => void {
  const buttons = [...toggles]
  const show = (paused: boolean) =>
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(paused)))
  const flip = () => pause.set(!pause.paused)
  show(pause.paused)
  const unsubscribe = pause.subscribe(show)
  buttons.forEach((button) => button.addEventListener('click', flip))
  return () => {
    unsubscribe()
    buttons.forEach((button) => button.removeEventListener('click', flip))
  }
}
