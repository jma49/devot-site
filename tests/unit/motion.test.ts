import { describe, expect, it } from 'vitest'
import {
  DURATION,
  EASE,
  onReducedMotionChange,
  prefersReducedMotion,
  revealOnScroll,
  setVar,
  STAGGER_STEP,
  staggerDelay,
} from '../../src/lib/motion.ts'
import { SCRUB_SNAP, scrubStep } from '../../src/lib/scroll.ts'
import { FakeElement, fakeEnv, rootOf } from '../support/dom-fakes.ts'
import { readRepoFile } from '../support/source-files.ts'

const html = (element: FakeElement) => element as unknown as HTMLElement

function reveals(count: number, attributes: Record<string, string>[] = []) {
  const elements = Array.from({ length: count }, (_, i) => new FakeElement(attributes[i]))
  return { elements, root: rootOf(elements) }
}

describe('staggerDelay', () => {
  it('steps by 50 ms unless told otherwise and never goes negative', () => {
    expect([0, 1, 3].map((index) => staggerDelay(index))).toEqual([0, 50, 150])
    expect(staggerDelay(2, 80)).toBe(160)
    expect(staggerDelay(-4)).toBe(0)
  })
})

describe('revealOnScroll', () => {
  it('reveals elements as they enter, staggered in document order', () => {
    const { elements, root } = reveals(3)
    const { env, observers } = fakeEnv()
    revealOnScroll(root, {}, env)
    const [observer] = observers
    expect([...(observer?.observed ?? [])]).toEqual(elements)

    observer?.deliver(
      { target: elements[2], isIntersecting: true },
      { target: elements[0], isIntersecting: true },
      { target: elements[1], isIntersecting: false },
    )

    expect(elements.map((e) => e.hasAttribute('data-revealed'))).toEqual([true, false, true])
    expect(elements.map((e) => e.properties.get('--site-reveal-delay'))).toEqual([
      '0ms',
      undefined,
      '50ms',
    ])
    expect([...(observer?.observed ?? [])]).toEqual([elements[1]])
  })

  it('starts a later batch from zero, takes data-reveal-index over arrival order, and honours step', () => {
    const { elements, root } = reveals(3, [{}, { revealIndex: '4' }, {}])
    const { env, observers } = fakeEnv()
    revealOnScroll(root, { step: 100 }, env)
    const [observer] = observers

    observer?.deliver({ target: elements[0], isIntersecting: true })
    observer?.deliver(
      { target: elements[1], isIntersecting: true },
      { target: elements[2], isIntersecting: true },
    )

    expect(elements.map((e) => e.properties.get('--site-reveal-delay'))).toEqual([
      '0ms',
      '400ms',
      '100ms',
    ])
  })

  it('observes with the given margin and threshold, and a margin that waits for the element', () => {
    const { env, observers } = fakeEnv()
    revealOnScroll(reveals(1).root, {}, env)
    revealOnScroll(reveals(1).root, { rootMargin: '48px 0px', threshold: 0.2 }, env)

    expect(observers.map((o) => o.options)).toEqual([
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
      { rootMargin: '48px 0px', threshold: 0.2 },
    ])
  })

  it('leaves elements that are already revealed alone', () => {
    const { elements, root } = reveals(2)
    elements[0]?.setAttribute('data-revealed', '')
    const { env, observers } = fakeEnv()
    revealOnScroll(root, {}, env)

    expect([...(observers[0]?.observed ?? [])]).toEqual([elements[1]])
  })

  it('shows everything at once under reduced motion, without observing', () => {
    const { elements, root } = reveals(2)
    const { env, observers } = fakeEnv({ reduced: true })
    revealOnScroll(root, {}, env)

    expect(elements.map((e) => e.hasAttribute('data-revealed'))).toEqual([true, true])
    expect(observers).toEqual([])
  })

  it('shows what is left and stops observing when reduced motion is turned on', () => {
    const { elements, root } = reveals(2)
    const fake = fakeEnv()
    revealOnScroll(root, {}, fake.env)
    fake.observers[0]?.deliver({ target: elements[0], isIntersecting: true })

    fake.setReducedMotion(true)

    expect(elements.map((e) => e.hasAttribute('data-revealed'))).toEqual([true, true])
    expect(fake.observers[0]?.disconnected).toBe(true)
  })

  it('stops observing and listening when cleaned up', () => {
    const fake = fakeEnv()
    const stop = revealOnScroll(reveals(1).root, {}, fake.env)
    expect(fake.reducedListeners.size).toBe(1)

    stop()

    expect(fake.observers[0]?.disconnected).toBe(true)
    expect(fake.reducedListeners.size).toBe(0)
  })
})

describe('scrubStep', () => {
  const frame = 1 / 60
  const run = (from: number, to: number, seconds: number, lag: number, step = frame) => {
    let value = from
    for (let t = 0; t < seconds - 1e-9; t += step) value = scrubStep(value, to, step, lag)
    return value
  }

  it('trails the scroll and closes almost all of the gap within the lag', () => {
    const first = scrubStep(0, 400, frame, 0.45)
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(60)
    expect(run(0, 400, 0.45 / 2, 0.45)).toBeLessThan(400 * 0.95)
    expect(run(0, 400, 0.45, 0.45)).toBeGreaterThan(400 * 0.97)
  })

  it('lands exactly on the target once within the snap distance, and follows at once with no lag', () => {
    expect(scrubStep(400 - SCRUB_SNAP / 2, 400, frame, 0.45)).toBe(400)
    expect(run(0, 400, 1.5, 0.45)).toBe(400)
    expect(scrubStep(0, 400, frame, 0)).toBe(400)
  })

  it('moves the same way up as down', () => {
    expect(400 - run(400, 0, 0.2, 0.45)).toBeCloseTo(run(0, 400, 0.2, 0.45), 6)
  })

  it('does not depend on the frame rate', () => {
    expect(run(0, 400, 0.3, 0.45, 1 / 120)).toBeCloseTo(run(0, 400, 0.3, 0.45, 1 / 30), 6)
  })

  it('does not overshoot a long frame', () => {
    expect(scrubStep(0, 400, 5, 0.45)).toBe(400)
  })
})

describe('reduced-motion helpers', () => {
  it('reads the setting and reports changes until stopped', () => {
    const fake = fakeEnv()
    const seen: boolean[] = []
    const stop = onReducedMotionChange((reduced) => seen.push(reduced), fake.env)
    expect(prefersReducedMotion(fake.env)).toBe(false)

    fake.setReducedMotion(true)
    expect(prefersReducedMotion(fake.env)).toBe(true)
    stop()
    fake.setReducedMotion(false)

    expect(seen).toEqual([true])
  })

  it('sets custom properties through the CSS object model', () => {
    const element = new FakeElement()
    setVar(html(element), '--site-shift', 12)
    expect(element.properties.get('--site-shift')).toBe('12')
  })
})

describe('the vocabulary in motion.ts and src/styles/motion.css', () => {
  const tokens = readRepoFile('src/theme/tokens.css')
  const motion = readRepoFile('src/styles/motion.css')
  const declared = (css: string, name: string) =>
    new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? ''
  const bezier = (name: string) => {
    const value = declared(motion, name)
    const token = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
    const resolved = token ? declared(tokens, token) : value
    return (/^cubic-bezier\(([^)]+)\)$/.exec(resolved)?.[1] ?? '').split(',').map(Number)
  }

  it('has the same easings', () => {
    expect(EASE.out).toEqual(bezier('--site-ease-out'))
    expect(EASE.text).toEqual(bezier('--site-ease-text'))
    expect(EASE.media).toEqual(bezier('--site-ease-media'))
  })

  it('has the same durations and stagger step', () => {
    const ms = (name: string) => Number.parseInt(declared(motion, name), 10)
    expect(DURATION).toEqual({
      quick: ms('--site-dur-quick'),
      reveal: ms('--site-dur-reveal'),
      media: ms('--site-dur-media'),
      hero: ms('--site-dur-hero'),
    })
    expect(STAGGER_STEP).toBe(ms('--site-stagger-step'))
  })

  it('hides nothing without scripting, or when reduced motion is asked for', () => {
    const hiding = /\[data-reveal\]:not\(\[data-revealed\]\)\s*\{/g
    const outside = motion.replace(/@media \(scripting: enabled\)[^{]*\{[\s\S]*?\n\}\n/, '')
    expect(motion.match(hiding)?.length).toBeGreaterThan(0)
    expect(outside).not.toMatch(hiding)
    expect(motion).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(motion).toMatch(/@supports \(animation-timeline: view\(\)\)/)
  })
})
