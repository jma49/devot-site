export interface SectionBox {
  id: string
  /** Pixels from the top of the viewport. */
  top: number
  bottom: number
}

/** Share of the viewport height at which the section being read is decided. */
export const READING_LINE = 0.4
/** The pill gives way once the closing call to action's top rises above this share. */
export const CLOSING_LINE = 0.85
/** The bar takes on its shadow after this much scroll. */
const SCROLLED_AT = 8
const WIDE_QUERY = '(min-width: 800px)'

/** The id of the section that crosses the reading line, or null when none does. */
export function activeSection(sections: SectionBox[], viewport: number): string | null {
  const line = viewport * READING_LINE
  return sections.find(({ top, bottom }) => top <= line && bottom > line)?.id ?? null
}

/**
 * Whether the floating download pill shows: once the hero's call to action has scrolled out
 * above the viewport, and until the closing call to action comes into view.
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

/** The index focus moves to on Tab (or Shift+Tab) in a trap of `count` items. */
export function trapIndex(count: number, current: number, backwards: boolean): number {
  if (current < 0) return backwards ? count - 1 : 0
  return (current + (backwards ? -1 : 1) + count) % count
}

const FOCUSABLE = 'a[href], button:not([disabled])'

/**
 * Starts the site header: the scrolled look of the bar, the section indicator, the download pill
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
    header.querySelector<HTMLElement>('[data-skip-link]'),
    pill,
  ].filter((element): element is HTMLElement => element !== null)
  const wide = window.matchMedia(WIDE_QUERY)
  let open = false

  const update = () => {
    const viewport = window.innerHeight
    header.toggleAttribute('data-scrolled', window.scrollY > SCROLLED_AT)
    const active = activeSection(
      targets.map((target) => {
        const { top, bottom } = target.getBoundingClientRect()
        return { id: target.id, top, bottom }
      }),
      viewport,
    )
    for (const link of links) {
      if (link.hash === `#${active}`) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    }
    const shown =
      !open &&
      heroCta !== null &&
      pillShown({
        ctaBottom: heroCta.getBoundingClientRect().bottom,
        closingTop: closing?.getBoundingClientRect().top ?? null,
        viewport,
      })
    pill.toggleAttribute('data-shown', shown)
  }

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      update()
    })
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
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  update()
}
