import { browserEnv, REDUCED_MOTION_QUERY, type DomEnv } from '../lib/dom-env.ts'
import { revealOnScroll, setVar } from '../lib/motion.ts'

/** Share of the viewport height a feature's media must cross to become the active item. */
export const ACTIVE_LINE = 0.4

/** Where the list sits beside the media; below it the features stack. */
export const DESKTOP_QUERY = '(min-width: 800px)'

/** Milliseconds a chosen item stays active while the page scrolls to it past the others. */
export const HOLD_MS = 1500

export interface Hold {
  index: number
  until: number
}

/** The last block whose top has reached `line`; the first while none has, -1 without blocks. */
export function activeIndex(tops: readonly number[], line: number): number {
  let index = tops.length > 0 ? 0 : -1
  tops.forEach((top, i) => {
    if (top <= line) index = i
  })
  return index
}

/**
 * How far the scroll has carried `line` through each block, from 0 to 1. A block runs from its
 * top to the next block's top, the last one over its own height.
 */
export function progressPast(
  tops: readonly number[],
  heights: readonly number[],
  line: number,
): number[] {
  return tops.map((top, i) => {
    const span = (tops[i + 1] ?? top + (heights[i] ?? 0)) - top
    if (span <= 0) return line >= top ? 1 : 0
    return Math.min(1, Math.max(0, (line - top) / span))
  })
}

/**
 * The scroll position that brings a block into view: centred when it fits, its top clear of the
 * header, and always above the active line, so the block it was chosen for becomes the active one.
 */
export function scrollTarget(
  block: { top: number; height: number },
  viewport: number,
  scrollY: number,
): number {
  const centred = (viewport - block.height) / 2
  const offset = Math.min(Math.max(centred, viewport * 0.12), viewport * ACTIVE_LINE - 24)
  return Math.max(0, Math.round(scrollY + block.top - offset))
}

/**
 * Where the marker settles beside the active item: from its top to its bottom once the list has
 * folded the others. `heads` are the items' heights without a description, `bodies` the heights
 * of their descriptions in full, so the answer holds while the descriptions are still moving.
 */
export function markerFrame(
  heads: readonly number[],
  bodies: readonly number[],
  active: number,
): { top: number; height: number } {
  if (active < 0 || active >= heads.length) return { top: 0, height: 0 }
  const top = heads.slice(0, active).reduce((sum, head) => sum + head, 0)
  return { top, height: (heads[active] ?? 0) + (bodies[active] ?? 0) }
}

/** The item to show as active, given the one the scroll position points at and any held choice. */
export function followScroll(
  scrolled: number,
  hold: Hold | null,
  now: number,
): { index: number; hold: Hold | null } {
  if (hold === null || now >= hold.until || scrolled === hold.index) {
    return { index: scrolled, hold: null }
  }
  return { index: hold.index, hold }
}

/**
 * Wires the feature list to the media beside it: the item whose media has crossed the active
 * line is marked current, the marker slides to it and its rail fills with the scroll; choosing an
 * item scrolls to its media. Only while the list sits beside the media; stacked, every feature shows in full.
 */
export function initFeatures(root: ParentNode = document, env: DomEnv = browserEnv()): () => void {
  const section = root.querySelector<HTMLElement>('[data-features]')
  if (section === null) return () => {}
  const items = [...section.querySelectorAll<HTMLElement>('[data-feature-item]')]
  const buttons = items.map((item) => item.querySelector<HTMLButtonElement>('button'))
  const heads = items.map((item) => item.querySelector<HTMLElement>('.feature-heading'))
  const bodies = items.map((item) => item.querySelector<HTMLElement>('.feature-detail > div'))
  const marker = section.querySelector<HTMLElement>('[data-features-marker]')
  const blocks = [...section.querySelectorAll<HTMLElement>('[data-feature]')]
  const wells = blocks.map(
    (block) => block.querySelector<HTMLElement>('[data-feature-well]') ?? block,
  )
  const desktop = env.matchMedia(DESKTOP_QUERY)
  const reduced = env.matchMedia(REDUCED_MOTION_QUERY)
  const stopReveal = revealOnScroll(section, { rootMargin: '0px 0px 48px 0px' }, env)

  let active = -1
  let hold: Hold | null = null
  let frame = 0

  const placeMarker = () => {
    if (marker === null || active < 0) return
    const { top, height } = markerFrame(
      heads.map((head) => head?.offsetHeight ?? 0),
      bodies.map((body) => body?.scrollHeight ?? 0),
      active,
    )
    setVar(marker, '--features-marker-y', `${top}px`)
    setVar(marker, '--features-marker-height', String(height))
  }

  const setActive = (index: number) => {
    if (index === active) return
    active = index
    placeMarker()
    items.forEach((item, i) => {
      const on = i === index
      item.toggleAttribute('data-active', on)
      blocks[i]?.toggleAttribute('data-active', on)
      if (on) buttons[i]?.setAttribute('aria-current', 'true')
      else buttons[i]?.removeAttribute('aria-current')
    })
  }

  const measure = () => {
    frame = 0
    const line = window.innerHeight * ACTIVE_LINE
    const rects = wells.map((well) => well.getBoundingClientRect())
    const tops = rects.map((rect) => rect.top)
    const next = followScroll(activeIndex(tops, line), hold, performance.now())
    hold = next.hold
    setActive(next.index)
    const filled = reduced.matches
      ? items.map((_, i) => (i === active ? 1 : 0))
      : progressPast(
          tops,
          rects.map((rect) => rect.height),
          line,
        )
    filled.forEach((value, i) => {
      const item = items[i]
      if (item) setVar(item, '--feature-progress', value.toFixed(4))
    })
  }
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(measure)
  }
  const release = () => {
    hold = null
  }

  const choose = (index: number) => {
    const well = wells[index]
    if (well === undefined) return
    hold = { index, until: performance.now() + HOLD_MS }
    setActive(index)
    window.scrollTo({
      top: scrollTarget(well.getBoundingClientRect(), window.innerHeight, window.scrollY),
      behavior: reduced.matches ? 'auto' : 'smooth',
    })
    schedule()
  }
  const clicks = buttons.map((button, index) => {
    const onClick = () => choose(index)
    button?.addEventListener('click', onClick)
    return () => button?.removeEventListener('click', onClick)
  })

  const passive = { passive: true } as const
  let following = false
  const follow = (on: boolean) => {
    if (on === following) return
    following = on
    const method = on ? 'addEventListener' : 'removeEventListener'
    window[method]('scroll', schedule, passive)
    window[method]('resize', schedule, passive)
    window[method]('resize', placeMarker, passive)
    for (const type of ['wheel', 'touchstart', 'keydown'] as const) {
      window[method](type, release, passive)
    }
    if (on) {
      placeMarker()
      schedule()
    }
  }
  const onDesktopChange = (event: { matches: boolean }) => follow(event.matches)
  const onReducedChange = () => schedule()

  section.setAttribute('data-features-ready', '')
  follow(desktop.matches)
  desktop.addEventListener('change', onDesktopChange)
  reduced.addEventListener('change', onReducedChange)

  return () => {
    follow(false)
    if (frame !== 0) cancelAnimationFrame(frame)
    clicks.forEach((stop) => stop())
    stopReveal()
    desktop.removeEventListener('change', onDesktopChange)
    reduced.removeEventListener('change', onReducedChange)
    section.removeAttribute('data-features-ready')
  }
}
