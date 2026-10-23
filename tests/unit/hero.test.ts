import { describe, expect, it } from 'vitest'
import {
  BACKDROP_LOOK,
  frameDue,
  parseBackdrop,
  srgbToOklab,
  tuneStop,
} from '../../src/scripts/hero-backdrop.ts'
import { HERO_SCROLL, heroScroll } from '../../src/scripts/hero.ts'
import { readRepoFile } from '../support/source-files.ts'

const tokensCss = readRepoFile('src/theme/tokens.css')

/** The --backdrop value the generated tokens give a Tide preview in one appearance. */
function tideBackdrop(appearance: 'light' | 'dark'): string {
  const rule = new RegExp(
    `\\[data-theme-preview='tide'\\]\\[data-appearance-preview='${appearance}'\\] \\{[^}]*--backdrop: ([^;]+);`,
  ).exec(tokensCss)
  if (!rule?.[1]) throw new Error(`no Tide ${appearance} backdrop in tokens.css`)
  return rule[1]
}

const chroma = ([, a, b]: readonly number[]) => Math.hypot(a ?? 0, b ?? 0)

describe('heroScroll', () => {
  const viewport = 900

  it('rests at the top: window tilted, copy in place, sheen on, dome off', () => {
    expect(heroScroll(0, viewport)).toEqual({
      settle: 0,
      drift: 0,
      lift: 0,
      sky: 0,
      sheen: 1,
      dome: 0,
    })
  })

  it('settles the window over 60 % of the viewport and lets the copy drift away sooner', () => {
    const half = heroScroll(0.3 * viewport, viewport)
    expect(half.settle).toBeCloseTo(0.5)
    expect(half.drift).toBeCloseTo(0.3 / 0.45)
    expect(heroScroll(0.6 * viewport, viewport).settle).toBe(1)
    expect(heroScroll(0.45 * viewport, viewport).drift).toBe(1)
    expect(heroScroll(5 * viewport, viewport)).toMatchObject({ settle: 1, drift: 1 })
  })

  it('lifts the window at a third of the scroll, clamped at 140 px', () => {
    expect(heroScroll(200, viewport).lift).toBeCloseTo(200 * HERO_SCROLL.liftRate)
    expect(HERO_SCROLL.liftRate).toBeGreaterThanOrEqual(0.3)
    expect(HERO_SCROLL.liftRate).toBeLessThanOrEqual(0.4)
    expect(heroScroll(2000, viewport).lift).toBe(140)
  })

  it('leaves the stylesheet room for the whole lift', () => {
    expect(readRepoFile('src/styles/home/hero.css')).toContain(
      `--hero-lift-room: ${HERO_SCROLL.liftMax}px;`,
    )
  })

  it('fades the sheen out over the first 200 px and the dome in from 60 to 180 px', () => {
    expect(heroScroll(100, viewport).sheen).toBeCloseTo(0.5)
    expect(heroScroll(200, viewport).sheen).toBe(0)
    expect(heroScroll(60, viewport).dome).toBe(0)
    expect(heroScroll(120, viewport).dome).toBeCloseTo(0.5)
    expect(heroScroll(180, viewport).dome).toBe(1)
  })

  it('moves the sky slower than the page, the same way in both directions', () => {
    const down = [0, 150, 300, 450].map((y) => heroScroll(y, viewport).sky)
    const up = [450, 300, 150, 0].map((y) => heroScroll(y, viewport).sky)
    expect(down).toEqual(up.toReversed())
    expect(down[1]).toBeCloseTo(150 * HERO_SCROLL.skyRate)
    expect(HERO_SCROLL.skyRate).toBeLessThan(1)
  })

  it('treats overscroll above the top as the top and a zero viewport as no progress', () => {
    expect(heroScroll(-80, viewport)).toEqual(heroScroll(0, viewport))
    expect(heroScroll(300, 0)).toMatchObject({ settle: 0, drift: 0 })
  })
})

describe('parseBackdrop', () => {
  it("reads the angle and the three stops of Tide's light and dark gradients", () => {
    expect(parseBackdrop(tideBackdrop('light'))).toEqual({
      angle: 160,
      stops: [
        [205, 223, 249],
        [230, 233, 248],
        [224, 214, 245],
      ],
    })
    expect(parseBackdrop(tideBackdrop('dark'))?.stops[0]).toEqual([34, 49, 77])
  })

  it('also reads the form a browser serialises, with commas', () => {
    expect(
      parseBackdrop(
        'linear-gradient(160deg, rgba(205, 223, 249, 0.7) 0%, rgba(230, 233, 248, 0.7) 50%, rgba(224, 214, 245, 0.7) 100%)',
      )?.stops[2],
    ).toEqual([224, 214, 245])
  })

  it('reads the hex form the minified stylesheet carries', () => {
    expect(
      parseBackdrop('linear-gradient(160deg,#cddff9b3 0%,#e6e9f8b3 50%,#e0d6f5b3 100%)'),
    ).toEqual({
      angle: 160,
      stops: [
        [205, 223, 249],
        [230, 233, 248],
        [224, 214, 245],
      ],
    })
    expect(parseBackdrop('linear-gradient(10deg, #abc, #102030 50%, #fff8)')?.stops).toEqual([
      [170, 187, 204],
      [16, 32, 48],
      [255, 255, 255],
    ])
  })

  it('refuses anything that is not a three-stop linear gradient', () => {
    expect(parseBackdrop('')).toBeNull()
    expect(parseBackdrop('none')).toBeNull()
    expect(parseBackdrop('linear-gradient(160deg, rgb(1 2 3) 0%, rgb(4 5 6) 100%)')).toBeNull()
  })
})

describe('colour', () => {
  it('converts sRGB to OKLab', () => {
    const white = srgbToOklab([255, 255, 255])
    expect(white[0]).toBeCloseTo(1, 3)
    expect(chroma(white)).toBeCloseTo(0, 3)
    const [l, a, b] = srgbToOklab([255, 0, 0])
    expect(l).toBeCloseTo(0.628, 3)
    expect(a).toBeCloseTo(0.2249, 3)
    expect(b).toBeCloseTo(0.1258, 3)
  })

  it('keeps the chroma boost at 1.15 or less in both appearances', () => {
    for (const look of Object.values(BACKDROP_LOOK)) {
      expect(look.gain).toBeGreaterThanOrEqual(1)
      expect(look.gain).toBeLessThanOrEqual(1.15)
    }
  })

  it('scales chroma by the gain and shifts lightness, keeping the hue', () => {
    const stop = srgbToOklab([205, 223, 249])
    const tuned = tuneStop([205, 223, 249], { gain: 1.1, lift: 0.02 })
    expect(chroma(tuned) / chroma(stop)).toBeCloseTo(1.1, 5)
    expect(tuned[0] - stop[0]).toBeCloseTo(0.02, 5)
    expect(Math.atan2(tuned[2], tuned[1])).toBeCloseTo(Math.atan2(stop[2], stop[1]), 5)
  })
})

describe('frameDue', () => {
  it('draws at most 30 frames a second, allowing for a display that runs a little fast', () => {
    expect(frameDue(1000, 1000 - 1000 / 30)).toBe(true)
    expect(frameDue(1000, 1000 - 31.5)).toBe(true)
    expect(frameDue(1000, 1000 - 16.7)).toBe(false)
    expect(frameDue(1000, -1)).toBe(true)
  })
})
