import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

export interface ScrollEffectOptions {
  /** An extra media query the effect needs, such as `(min-width: 800px)`. */
  when?: string
}

/**
 * Runs `setup` while reduced motion is not requested and the `when` query matches. It creates
 * GSAP tweens and ScrollTriggers; they are reverted, and the styles GSAP wrote removed, when the
 * query stops matching or the returned function is called. Set start states inside `setup`
 * (`gsap.from`, `gsap.set`), never in CSS, so the markup reads in full without the effect.
 */
export function scrollEffects(
  setup: gsap.ContextFunc,
  { when }: ScrollEffectOptions = {},
): () => void {
  const query = ['(prefers-reduced-motion: no-preference)', when].filter(Boolean).join(' and ')
  const matches = gsap.matchMedia()
  matches.add(query, setup)
  return () => matches.revert()
}
