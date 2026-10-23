import { setVar } from '../lib/motion.ts'
import { gsap, scrollEffects } from '../lib/scroll.ts'
import { startBackdrop } from './hero-backdrop.ts'

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
} as const

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

function applyScroll(hero: HTMLElement, state: HeroScroll): void {
  for (const [key, name] of Object.entries(VARS) as [keyof HeroScroll, `--${string}`][]) {
    setVar(hero, name, Number(state[key].toFixed(4)))
  }
}

/**
 * Starts the hero: the gradient backdrop, and the first-scroll choreography that hero.css draws
 * from the `--hero-*` variables. Scroll is smoothed a little, so uneven wheels still glide.
 */
export function startHero(root: ParentNode = document): void {
  const hero = root.querySelector<HTMLElement>('[data-hero]')
  const canvas = hero?.querySelector<HTMLCanvasElement>('[data-hero-canvas]')
  const light = hero?.querySelector<HTMLElement>('[data-backdrop-source="light"]')
  const dark = hero?.querySelector<HTMLElement>('[data-backdrop-source="dark"]')
  if (!hero || !canvas || !light || !dark) return

  startBackdrop({ hero, canvas, sources: { light, dark } })

  scrollEffects(() => {
    const progress = { y: 0 }
    const apply = () => applyScroll(hero, heroScroll(progress.y, window.innerHeight))
    gsap.to(progress, {
      y: () => hero.offsetHeight,
      ease: 'none',
      onUpdate: apply,
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.45,
        invalidateOnRefresh: true,
      },
    })
    apply()
    return () => Object.values(VARS).forEach((name) => hero.style.removeProperty(name))
  })
}
