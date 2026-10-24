import { browserEnv, REDUCED_MOTION_QUERY, type DomEnv } from './dom-env.ts'

/** Cubic-bezier control points of the easings in src/styles/motion.css. */
export const EASE = {
  out: [0, 0, 0.58, 1],
  text: [0.42, 0, 0.58, 1],
  media: [0.38, 0.7, 0.125, 1],
} as const

/** Milliseconds, as the duration scale in src/styles/motion.css. */
export const DURATION = { quick: 200, reveal: 400, media: 700, hero: 1000 } as const

export const STAGGER_STEP = 50

export function prefersReducedMotion(env: DomEnv = browserEnv()): boolean {
  return env.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Calls `handler` with the new value whenever the reduced-motion setting changes. */
export function onReducedMotionChange(
  handler: (reduced: boolean) => void,
  env: DomEnv = browserEnv(),
): () => void {
  const query = env.matchMedia(REDUCED_MOTION_QUERY)
  const listener = (event: { matches: boolean }) => handler(event.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

/** Sets a custom property through the CSS object model, which the CSP allows; `style=` it does not. */
export function setVar(element: HTMLElement, name: `--${string}`, value: string | number): void {
  element.style.setProperty(name, String(value))
}

export function staggerDelay(index: number, step: number = STAGGER_STEP): number {
  return Math.max(0, index) * step
}

export interface RevealOptions {
  selector?: string
  /** Positive values start the reveal before the element enters; negative ones after. */
  rootMargin?: string
  threshold?: number
  /** Milliseconds between elements that arrive together. */
  step?: number
}

/**
 * Reveals `[data-reveal]` elements once, as they scroll in: sets `data-revealed`, which
 * src/styles/motion.css turns into the transition. Elements that arrive together are staggered in
 * document order, or by `data-reveal-index` when set. With reduced motion everything is revealed
 * at once. Returns a function that stops observing.
 */
export function revealOnScroll(
  root: ParentNode = document,
  options: RevealOptions = {},
  env: DomEnv = browserEnv(),
): () => void {
  const { selector = '[data-reveal]', rootMargin = '0px 0px -8% 0px', threshold = 0 } = options
  const step = options.step ?? STAGGER_STEP
  const targets = [...root.querySelectorAll<HTMLElement>(selector)].filter(
    (element) => !element.hasAttribute('data-revealed'),
  )
  const show = (element: HTMLElement) => element.setAttribute('data-revealed', '')

  const reduced = env.matchMedia(REDUCED_MOTION_QUERY)
  if (reduced.matches) {
    targets.forEach(show)
    return () => {}
  }

  const order = new Map(targets.map((element, index) => [element, index]))
  const observer = env.createObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement)
        .toSorted((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
        .forEach((element, arrival) => {
          const explicit = Number.parseInt(element.dataset['revealIndex'] ?? '', 10)
          const index = Number.isNaN(explicit) ? arrival : explicit
          setVar(element, '--site-reveal-delay', `${staggerDelay(index, step)}ms`)
          show(element)
          observer.unobserve(element)
        })
    },
    { rootMargin, threshold },
  )
  const stopOnReduce = (event: { matches: boolean }) => {
    if (!event.matches) return
    observer.disconnect()
    targets.forEach(show)
  }
  reduced.addEventListener('change', stopOnReduce)
  targets.forEach((element) => observer.observe(element))
  return () => {
    observer.disconnect()
    reduced.removeEventListener('change', stopOnReduce)
  }
}
