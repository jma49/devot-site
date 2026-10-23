import { setVar } from '../lib/motion.ts'
import { scrollEffects, scrubScroll } from '../lib/scroll.ts'

/** The first scroll through the hero, in viewport heights and pixels. */
export const HERO_SCROLL = {
  /** The window stands up from its tilt over this share of the viewport. */
  settleRange: 0.6,
  /** The headline and its lead drift up and fade over this share. */
  driftRange: 0.45,
  /** The window falls behind the page by this share of the scroll, up to `liftMax` pixels. */
  liftRate: 0.35,
  liftMax: 140,
  skyRate: 0.4,
  sheenEnd: 200,
  domeStart: 60,
  domeEnd: 180,
  /** Seconds the layers trail the scroll by. */
  lag: 0.45,
} as const

/**
 * Phones keep the CSS gradient: building the shader holds a phone's main thread for longer than a
 * frame, and at that size the CSS layers look the same.
 */
export const WEBGL_QUERY = '(min-width: 640px)'

export interface HeroScroll {
  /** 0 tilted, 1 upright. */
  settle: number
  /** 0 in place, 1 gone. */
  drift: number
  /** Pixels the window group trails the page by. */
  lift: number
  /** Pixels the background trails the page by. */
  sky: number
  /** Opacity of the light behind the headline. */
  sheen: number
  /** Opacity of the horizon under the window. */
  dome: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Where every scroll-linked layer of the hero stands `scroll` pixels into it. */
export function heroScroll(scroll: number, viewport: number): HeroScroll {
  const y = Math.max(0, scroll)
  const progress = (range: number) => (viewport > 0 ? clamp01(y / (range * viewport)) : 0)
  const { liftRate, liftMax, skyRate, sheenEnd, domeStart, domeEnd } = HERO_SCROLL
  return {
    settle: progress(HERO_SCROLL.settleRange),
    drift: progress(HERO_SCROLL.driftRange),
    lift: Math.min(liftMax, y * liftRate),
    sky: y * skyRate,
    sheen: 1 - clamp01(y / sheenEnd),
    dome: clamp01((y - domeStart) / (domeEnd - domeStart)),
  }
}

const VARS = {
  settle: '--hero-settle',
  drift: '--hero-drift',
  lift: '--hero-lift',
  sky: '--hero-sky',
  sheen: '--hero-sheen',
  dome: '--hero-dome',
} as const satisfies Record<keyof HeroScroll, `--${string}`>

function applyScroll(hero: HTMLElement, state: HeroScroll, written: Map<string, string>): void {
  for (const [key, name] of Object.entries(VARS) as [keyof HeroScroll, `--${string}`][]) {
    const value = String(Number(state[key].toFixed(4)))
    if (written.get(name) === value) continue
    written.set(name, value)
    setVar(hero, name, value)
  }
}

/**
 * Runs `task` once the page has loaded and painted a frame, when the main thread has a moment to
 * spare.
 */
function afterFirstPaint(task: () => void): void {
  const idle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(task, { timeout: 1000 })
    } else {
      setTimeout(task, 0)
    }
  }
  const painted = () => requestAnimationFrame(() => requestAnimationFrame(idle))
  if (document.readyState === 'complete') painted()
  else window.addEventListener('load', painted, { once: true })
}

/**
 * Starts the hero: the first-scroll choreography that hero.css draws from the `--hero-*`
 * variables, and the WebGL backdrop, which loads once the page has painted with the CSS gradient
 * standing in for it.
 */
export function startHero(root: ParentNode = document): void {
  const hero = root.querySelector<HTMLElement>('[data-hero]')
  const canvas = hero?.querySelector<HTMLCanvasElement>('[data-hero-canvas]')
  const light = hero?.querySelector<HTMLElement>('[data-backdrop-source="light"]')
  const dark = hero?.querySelector<HTMLElement>('[data-backdrop-source="dark"]')
  if (!hero || !canvas || !light || !dark) return

  afterFirstPaint(() => {
    import('./hero-backdrop.ts')
      .then(({ startBackdrop }) =>
        startBackdrop({
          hero,
          canvas,
          sources: { light, dark },
          webgl: window.matchMedia(WEBGL_QUERY).matches,
        }),
      )
      .catch((error: unknown) =>
        console.warn('W_HERO_BACKDROP_LOAD', error instanceof Error ? error.name : 'unknown'),
      )
  })

  scrollEffects(() => {
    let height = hero.offsetHeight
    const sizes = new ResizeObserver(() => {
      height = hero.offsetHeight
    })
    sizes.observe(hero)
    const written = new Map<string, string>()
    const stop = scrubScroll(
      (scroll) =>
        applyScroll(hero, heroScroll(Math.min(scroll, height), window.innerHeight), written),
      { lag: HERO_SCROLL.lag },
    )
    return () => {
      stop()
      sizes.disconnect()
      Object.values(VARS).forEach((name) => hero.style.removeProperty(name))
    }
  })
}
