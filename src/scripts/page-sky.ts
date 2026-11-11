import { afterFirstPaint } from '../lib/first-paint.ts'
import { WEBGL_QUERY } from '../lib/webgl.ts'

type Observe = (
  callback: IntersectionObserverCallback,
) => Pick<IntersectionObserver, 'observe' | 'disconnect'>

/**
 * Calls `report` with whether any of `parts` is on screen, once it is known and on each change;
 * returns a function that stops it.
 */
export function anyOnScreen(
  parts: readonly Element[],
  report: (shown: boolean) => void,
  observe: Observe = (callback) => new IntersectionObserver(callback),
): () => void {
  const shown = new Set<Element>()
  let last: boolean | null = null
  const observer = observe((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting) shown.add(target)
      else shown.delete(target)
    }
    const now = shown.size > 0
    if (now === last) return
    last = now
    report(now)
  })
  parts.forEach((part) => observer.observe(part))
  return () => observer.disconnect()
}

/** What lies under the page's sky: every section but the hero, which has its own, and the footer. */
const UNDER_SKY = 'main > section:not([data-hero]), body > footer'

/**
 * Gives the sky behind the page the hero's flowing aurora, in its soft form. The hero covers the
 * sky at the top of the page, so the shader is built the first time a part under the sky comes on
 * screen, and rests whenever none is. The CSS aurora shows until then, and stays on phones.
 */
export function startPageSky(root: ParentNode = document): void {
  const sky = root.querySelector<HTMLElement>('[data-page-sky]')
  const canvas = sky?.querySelector<HTMLCanvasElement>('[data-sky-canvas]')
  const light = sky?.querySelector<HTMLElement>('[data-backdrop-source="light"]')
  const dark = sky?.querySelector<HTMLElement>('[data-backdrop-source="dark"]')
  const under = [...root.querySelectorAll(UNDER_SKY)]
  if (!sky || !canvas || !light || !dark || under.length === 0) return
  if (!window.matchMedia(WEBGL_QUERY).matches) return

  const inView = (report: (shown: boolean) => void) => anyOnScreen(under, report)
  const begin = () => {
    import('./hero-backdrop.ts')
      .then(({ startBackdrop }) =>
        startBackdrop({
          stage: sky,
          canvas,
          sources: { light, dark },
          soft: true,
          thrifty: true,
          inView,
        }),
      )
      .catch((error: unknown) =>
        console.warn('W_SKY_BACKDROP_LOAD', error instanceof Error ? error.name : 'unknown'),
      )
  }
  let stop = () => {}
  stop = anyOnScreen(under, (shown) => {
    if (!shown) return
    stop()
    afterFirstPaint(begin)
  })
}
