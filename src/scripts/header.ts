import { bindPauseToggles, browserPause } from './pause.ts'

export interface SectionBox {
  id: string
  /** Pixels from the top of the viewport. */
  top: number
  bottom: number
}

/** Share of the viewport height at which the section being read is decided. */
export const READING_LINE = 0.4
/** The pill gives way once the closing section's top rises above this share of the viewport. */
export const CLOSING_LINE = 1
/** The corner pill steps aside while it would cover this share of a clip's visible part. */
export const PILL_COVER_LIMIT = 0.05
/** The bar takes on its shadow after this much scroll. */
const SCROLLED_AT = 8
const WIDE_QUERY = '(min-width: 800px)'
const SETTLE_MS = 800

/** The id of the section that crosses the reading line, or null when none does. */
export function activeSection(sections: SectionBox[], viewport: number): string | null {
  const line = viewport * READING_LINE
  return sections.find(({ top, bottom }) => top <= line && bottom > line)?.id ?? null
}

/**
 * Whether the floating download pill shows: once the hero's call to action has scrolled out
 * above the viewport, and until any of the closing section comes into view, so it never sits over
 * the closing call to action or the footer.
 */
export function pillShown({
  ctaBottom,
  closingTop,
  viewport,
}: {
  ctaBottom: number
  closingTop: number | null
  viewport: number
}): boolean {
  return ctaBottom < 0 && (closingTop === null || closingTop > viewport * CLOSING_LINE)
}

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** The part every box shares, or null when they do not all overlap. */
export function intersect(...boxes: Box[]): Box | null {
  const [first, ...rest] = boxes
  if (!first) return null
  const box = rest.reduce(
    (shared, next) => ({
      left: Math.max(shared.left, next.left),
      top: Math.max(shared.top, next.top),
      right: Math.min(shared.right, next.right),
      bottom: Math.min(shared.bottom, next.bottom),
    }),
    first,
  )
  return box.right > box.left && box.bottom > box.top ? box : null
}

const area = ({ left, top, right, bottom }: Box) => (right - left) * (bottom - top)

/** The largest share of any clip's on-screen part that `pill` covers. */
export function coveredShare(pill: Box, clips: Box[], view: Box): number {
  return clips.reduce((largest, clip) => {
    const shown = intersect(clip, view)
    const covered = shown && intersect(shown, pill)
    return covered ? Math.max(largest, area(covered) / area(shown)) : largest
  }, 0)
}

export function clearOfClips(pill: Box, clips: Box[], view: Box): boolean {
  return coveredShare(pill, clips, view) < PILL_COVER_LIMIT
}

/** The index focus moves to on Tab (or Shift+Tab) in a trap of `count` items. */
export function trapIndex(count: number, current: number, backwards: boolean): number {
  if (current < 0) return backwards ? count - 1 : 0
  return (current + (backwards ? -1 : 1) + count) % count
}

const FOCUSABLE = 'a[href], button:not([disabled])'

/**
 * Starts the site header: the scrolled look of the bar, the section indicator, the pause toggle,
 * the download pill (on wide screens a corner pill that steps aside while it would cover a clip)
 * and, on narrow screens, the menu (focus kept inside, page scroll locked, Escape closes).
 */
export function startHeader(root: Document = document): void {
  const header = root.querySelector<HTMLElement>('[data-site-header]')
  const scope = header?.querySelector<HTMLElement>('[data-menu-scope]')
  const button = header?.querySelector<HTMLButtonElement>('[data-menu-button]')
  const pill = header?.querySelector<HTMLElement>('[data-download-pill]')
  if (!header || !scope || !button || !pill) return

  const links = [...header.querySelectorAll<HTMLAnchorElement>('a[data-nav-section]')]
  const targets = links
    .map((link) => root.getElementById(link.hash.slice(1)))
    .filter((target): target is HTMLElement => target !== null)
  const heroCta = root.querySelector<HTMLElement>('[data-hero-cta]')
  const closing = root.getElementById('download')
  const outside = [
    root.querySelector<HTMLElement>('main'),
    root.querySelector<HTMLElement>('body > footer'),
    root.querySelector<HTMLElement>('[data-skip-link]'),
    pill,
  ].filter((element): element is HTMLElement => element !== null)
  const wide = window.matchMedia(WIDE_QUERY)
  const clips = [...root.querySelectorAll<HTMLElement>('video[data-clip]')]
  let open = false
  let measured = false
  let inset = { right: 0, bottom: 0 }
  // Each clip with the ancestors that clip it: what shows of it is what they all share.
  let clipChains: HTMLElement[][] = []

  const measure = () => {
    const style = getComputedStyle(pill)
    inset = { right: parseFloat(style.right), bottom: parseFloat(style.bottom) }
    clipChains = clips.map((clip) => {
      const chain = [clip]
      for (let at = clip.parentElement; at && at !== root.body; at = at.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(at)
        if (overflowX !== 'visible' || overflowY !== 'visible') chain.push(at)
      }
      return chain
    })
    measured = true
  }

  /** Whether the corner pill, where it rests, would cover too much of a clip on screen. */
  const coversClip = () => {
    if (!measured) measure()
    const view = {
      left: 0,
      top: 0,
      right: root.documentElement.clientWidth,
      bottom: root.documentElement.clientHeight,
    }
    const right = view.right - inset.right
    const bottom = view.bottom - inset.bottom
    const resting = {
      left: right - pill.offsetWidth,
      top: bottom - pill.offsetHeight,
      right,
      bottom,
    }
    const shown = clipChains.flatMap(([clip, ...clippers]) => {
      const box = clip && intersect(clip.getBoundingClientRect(), view)
      const visible = box && intersect(box, ...clippers.map((at) => at.getBoundingClientRect()))
      return visible ? [visible] : []
    })
    return !clearOfClips(resting, shown, view)
  }

  // Every measurement comes before the first write, so a frame lays out once.
  const update = () => {
    const viewport = window.innerHeight
    const scrolled = window.scrollY > SCROLLED_AT
    const sections = targets.map((target) => {
      const { top, bottom } = target.getBoundingClientRect()
      return { id: target.id, top, bottom }
    })
    const ctaBottom = heroCta?.getBoundingClientRect().bottom
    const closingTop = closing?.getBoundingClientRect().top ?? null
    const due = !open && ctaBottom !== undefined && pillShown({ ctaBottom, closingTop, viewport })
    const aside = due && wide.matches && coversClip()

    const active = activeSection(sections, viewport)
    header.toggleAttribute('data-scrolled', scrolled)
    pill.toggleAttribute('data-shown', due && !aside)
    pill.toggleAttribute('data-aside', aside)
    for (const link of links) {
      const current = link.hash === `#${active}`
      if (current === link.hasAttribute('aria-current')) continue
      if (current) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    }
  }

  // Clips keep moving for a moment after the scroll stops (eased drift, reveals), so the pill
  // checks again on every frame until they have settled.
  let frame = 0
  let settleUntil = 0
  const tick = (now: number) => {
    frame = 0
    update()
    if (now < settleUntil) frame = requestAnimationFrame(tick)
  }
  const schedule = () => {
    settleUntil = performance.now() + SETTLE_MS
    if (!frame) frame = requestAnimationFrame(tick)
  }

  const focusables = () =>
    [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.getClientRects().length > 0,
    )

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      button.focus()
    } else if (event.key === 'Tab') {
      const items = focusables()
      const next =
        items[
          trapIndex(items.length, items.indexOf(root.activeElement as HTMLElement), event.shiftKey)
        ]
      if (!next) return
      event.preventDefault()
      next.focus()
    }
  }

  const setOpen = (value: boolean) => {
    if (open === value) return
    open = value
    button.setAttribute('aria-expanded', String(value))
    header.toggleAttribute('data-menu-open', value)
    root.documentElement.toggleAttribute('data-menu-open', value)
    outside.forEach((element) => (element.inert = value))
    if (value) root.addEventListener('keydown', onKey)
    else root.removeEventListener('keydown', onKey)
    update()
  }

  button.addEventListener('click', () => {
    setOpen(!open)
    if (open) scope.querySelector<HTMLElement>('[data-menu-panel] a')?.focus()
  })
  scope.addEventListener('click', (event) => {
    if (open && (event.target as Element).closest('a')) setOpen(false)
  })
  wide.addEventListener('change', () => {
    if (wide.matches) setOpen(false)
  })
  bindPauseToggles(
    header.querySelectorAll<HTMLButtonElement>('[data-motion-toggle]'),
    browserPause(),
  )
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', () => {
    measured = false
    schedule()
  })
  root.addEventListener('transitionend', (event) => {
    if ((event.target as Element).matches('[data-reveal]')) schedule()
  })
  update()
}
