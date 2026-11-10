import { setVar } from '../lib/motion.ts'
import { scrollEffects, scrubScroll } from '../lib/scroll.ts'
import { followClip, type NightClip } from './hero-night.ts'

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
  /** The night gives way to the reader's own scheme between these shares of the viewport. */
  nightStart: 0.06,
  nightEnd: 0.5,
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
  /** How much of the night is left: 1 at the top of the page, 0 once the window stands. */
  night: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => value * value * (3 - 2 * value)

/** Where every scroll-linked layer of the hero stands `scroll` pixels into it. */
export function heroScroll(scroll: number, viewport: number): HeroScroll {
  const y = Math.max(0, scroll)
  const progress = (range: number) => (viewport > 0 ? clamp01(y / (range * viewport)) : 0)
  const { liftRate, liftMax, skyRate, sheenEnd, domeStart, domeEnd, nightStart, nightEnd } =
    HERO_SCROLL
  const gone = viewport > 0 ? clamp01((y / viewport - nightStart) / (nightEnd - nightStart)) : 0
  return {
    settle: progress(HERO_SCROLL.settleRange),
    drift: progress(HERO_SCROLL.driftRange),
    lift: Math.min(liftMax, y * liftRate),
    sky: y * skyRate,
    sheen: 1 - clamp01(y / sheenEnd),
    dome: clamp01((y - domeStart) / (domeEnd - domeStart)),
    night: 1 - smooth(gone),
  }
}

const VARS = {
  settle: '--hero-settle',
  drift: '--hero-drift',
  lift: '--hero-lift',
  sky: '--hero-sky',
  sheen: '--hero-sheen',
  dome: '--hero-dome',
  night: '--hero-night',
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

const DARK_QUERY = '(prefers-color-scheme: dark)'
const SCOPE = ['data-scope', 'data-appearance-preview'] as const

/** Dresses `element` in the dark appearance whatever the reader's scheme, or leaves it to that. */
function wear(element: HTMLElement | null, night: boolean): void {
  if (!element || element.hasAttribute(SCOPE[0]) === night) return
  for (const name of SCOPE) {
    if (night) element.setAttribute(name, 'dark')
    else element.removeAttribute(name)
  }
}

/**
 * The night over the hero. The page opens under it in either scheme: the hero and the header over
 * it wear the dark appearance, and on a light page the dark recording lies over the hero clip.
 * `set` moves it: the hero wears the night until half of it has gone, the header for as long as it
 * is also over the hero, and the dark recording follows the clip until none of it shows.
 */
function startNight(hero: HTMLElement): { set(night: number): void } {
  const header = document.querySelector<HTMLElement>('[data-site-header]')
  const cover = hero.querySelector<HTMLElement>('[data-hero-night]')
  const recording = cover?.querySelector<HTMLVideoElement>('video')
  const clip = hero.querySelector<HTMLVideoElement>('video[data-clip="hero"]')
  const dark = window.matchMedia(DARK_QUERY)
  let night = 1
  let underHeader = true
  let following: NightClip | null = null

  const dress = () => {
    wear(hero, night >= 0.5)
    wear(header, night >= 0.5 && underHeader)
  }
  // A dark page shows the dark recording as its hero clip, so nothing lies over it.
  const follow = () => {
    following?.stop()
    following = null
    if (dark.matches || !cover || !recording || !clip) return
    following = followClip(clip, recording, () => {
      cover.hidden = true
    })
    following.rest(night <= 0)
  }

  new IntersectionObserver(
    ([entry]) => {
      underHeader = entry?.isIntersecting ?? true
      dress()
    },
    // The strip of the viewport the header floats in.
    { rootMargin: '0px 0px -92% 0px' },
  ).observe(hero)
  dark.addEventListener('change', follow)
  follow()
  dress()

  return {
    set(value) {
      if (value === night) return
      night = value
      dress()
      following?.rest(night <= 0)
    },
  }
}

/**
 * Starts the hero: the night it opens under, the first-scroll choreography that hero.css draws
 * from the `--hero-*` variables, and the WebGL backdrop, which loads once the page has painted
 * with the CSS gradient standing in for it.
 */
export function startHero(root: ParentNode = document): void {
  const hero = root.querySelector<HTMLElement>('[data-hero]')
  const canvas = hero?.querySelector<HTMLCanvasElement>('[data-hero-canvas]')
  const light = hero?.querySelector<HTMLElement>('[data-backdrop-source="light"]')
  const dark = hero?.querySelector<HTMLElement>('[data-backdrop-source="dark"]')
  if (!hero || !canvas || !light || !dark) return

  const night = startNight(hero)
  let left = 1
  let repaint = () => {}
  const setNight = (value: number) => {
    if (value === left) return
    left = value
    night.set(value)
    repaint()
  }

  afterFirstPaint(() => {
    import('./hero-backdrop.ts')
      .then(({ startBackdrop }) => {
        repaint = startBackdrop({
          hero,
          canvas,
          sources: { light, dark },
          webgl: window.matchMedia(WEBGL_QUERY).matches,
          night: () => left,
        }).repaint
      })
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
      (scroll) => {
        const state = heroScroll(Math.min(scroll, height), window.innerHeight)
        applyScroll(hero, state, written)
        setNight(Number(state.night.toFixed(3)))
      },
      { lag: HERO_SCROLL.lag },
    )
    return () => {
      stop()
      sizes.disconnect()
      Object.values(VARS).forEach((name) => hero.style.removeProperty(name))
      setNight(1)
    }
  })
}
