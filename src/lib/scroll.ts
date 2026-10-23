/** Pixels from the target at which a scrubbed value lands on it and stops. */
export const SCRUB_SNAP = 0.5

/**
 * Moves a scrubbed value `seconds` closer to `target`: an exponential approach that closes about
 * 98 % of the gap in `lag` seconds whatever the frame rate, and lands on the target once within
 * `SCRUB_SNAP`. A lag of 0 follows at once.
 */
export function scrubStep(current: number, target: number, seconds: number, lag: number): number {
  if (lag <= 0) return target
  const next = current + (target - current) * (1 - Math.exp((-4 * seconds) / lag))
  return Math.abs(target - next) < SCRUB_SNAP ? target : next
}

export interface ScrollEffectOptions {
  /** An extra media query the effect needs, such as `(min-width: 800px)`. */
  when?: string
}

/**
 * Runs `setup` while reduced motion is not requested and the `when` query matches. The function
 * `setup` returns undoes the effect; it runs when the query stops matching or the returned
 * function is called. Set start states inside `setup`, never in CSS, so the markup reads in full
 * without the effect.
 */
export function scrollEffects(
  setup: () => () => void,
  { when }: ScrollEffectOptions = {},
): () => void {
  const query = window.matchMedia(
    ['(prefers-reduced-motion: no-preference)', when].filter(Boolean).join(' and '),
  )
  let undo: (() => void) | null = null
  const sync = () => {
    if (query.matches && !undo) undo = setup()
    else if (!query.matches && undo) {
      undo()
      undo = null
    }
  }
  query.addEventListener('change', sync)
  sync()
  return () => {
    query.removeEventListener('change', sync)
    undo?.()
    undo = null
  }
}

export interface ScrubOptions {
  /** Seconds the value takes to catch up with the scroll, so uneven wheels still glide. */
  lag?: number
}

/**
 * Calls `apply` with the page's scroll position, eased by `scrubStep`: once at the start, then on
 * every frame while the value is catching up, and again on resize. Nothing runs while the page is
 * still. Returns a function that stops it.
 */
export function scrubScroll(
  apply: (scroll: number) => void,
  { lag = 0.45 }: ScrubOptions = {},
): () => void {
  let current = window.scrollY
  let frame = 0
  let last = 0

  const tick = (now: number) => {
    const seconds = last ? (now - last) / 1000 : 1 / 60
    const target = window.scrollY
    last = now
    current = scrubStep(current, target, seconds, lag)
    apply(current)
    if (current === target) {
      frame = 0
      last = 0
    } else {
      frame = requestAnimationFrame(tick)
    }
  }
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick)
  }
  const resize = () => apply(current)

  window.addEventListener('scroll', wake, { passive: true })
  window.addEventListener('resize', resize)
  apply(current)
  return () => {
    cancelAnimationFrame(frame)
    frame = 0
    window.removeEventListener('scroll', wake)
    window.removeEventListener('resize', resize)
  }
}
