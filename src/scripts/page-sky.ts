import { afterFirstPaint } from '../lib/first-paint.ts'
import { WEBGL_QUERY } from '../lib/webgl.ts'

/** Where sky.css takes the sky away, and its canvas with it: the hero keeps its CSS aurora. */
const NO_SKY_QUERY = '(forced-colors: active)'

/**
 * Gives the page its flowing aurora: one shader on the canvas fixed behind the page, which the
 * hero shows at full strength and every section after it in its soft form under the veil. It
 * loads once the page has painted, with the CSS auroras standing in for it; they stay on phones.
 */
export function startPageSky(root: ParentNode = document): void {
  const sky = root.querySelector<HTMLElement>('[data-page-sky]')
  const canvas = sky?.querySelector<HTMLCanvasElement>('[data-sky-canvas]')
  const light = sky?.querySelector<HTMLElement>('[data-backdrop-source="light"]')
  const dark = sky?.querySelector<HTMLElement>('[data-backdrop-source="dark"]')
  const hero = root.querySelector<HTMLElement>('[data-hero]')
  const heroSky = hero?.querySelector<HTMLElement>('[data-hero-sky]')
  if (!sky || !canvas || !light || !dark || !hero || !heroSky) return

  afterFirstPaint(() => {
    import('./hero-backdrop.ts')
      .then(({ startBackdrop }) =>
        startBackdrop({
          stage: sky,
          canvas,
          sources: { light, dark },
          hero,
          heroSky,
          webgl: window.matchMedia(WEBGL_QUERY).matches && !window.matchMedia(NO_SKY_QUERY).matches,
        }),
      )
      .catch((error: unknown) =>
        console.warn('W_SKY_BACKDROP_LOAD', error instanceof Error ? error.name : 'unknown'),
      )
  })
}
