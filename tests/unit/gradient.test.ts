import { describe, expect, it } from 'vitest'
import { parseGradient } from '../../src/lib/gradient.ts'
import { readRepoFile } from '../support/source-files.ts'

describe('parseGradient', () => {
  it('reads the angle and each stop with its offset', () => {
    expect(
      parseGradient(
        'linear-gradient(160deg, rgb(205 223 249 / 0.7) 0%, #e6e9f8 50%, rgb(1 2 3) 100%)',
      ),
    ).toEqual({
      angle: 160,
      stops: [
        { colours: ['rgb(205 223 249 / 0.7)'], share: 1, offset: 0 },
        { colours: ['#e6e9f8'], share: 1, offset: 0.5 },
        { colours: ['rgb(1 2 3)'], share: 1, offset: 1 },
      ],
    })
  })

  it('reads a stop mixed from two colours and the share of the first', () => {
    const mixed = (share: string) =>
      parseGradient(
        `linear-gradient(90deg, color-mix(in srgb, rgb(0 0 0) ${share}, rgb(9 9 9)) 0%, rgb(9 9 9) 100%)`,
      )?.stops[0]
    expect(mixed('calc(40 * 1%)')).toEqual({
      colours: ['rgb(0 0 0)', 'rgb(9 9 9)'],
      share: 0.4,
      offset: 0,
    })
    expect(mixed('60%')?.share).toBe(0.6)
    expect(mixed('calc(100*1%)')?.share).toBe(1)
  })

  it('takes the fallback of a variable the value still names', () => {
    expect(
      parseGradient(
        'linear-gradient(160deg, color-mix(in srgb, rgb(0 0 0) calc(var(--gradient-strength, 100) * 1%), rgb(9 9 9)) 0%, rgb(9 9 9) 100%)',
      )?.stops[0]?.share,
    ).toBe(1)
  })

  it('reads the form a minified stylesheet carries', () => {
    expect(
      parseGradient(
        'linear-gradient(160deg,color-mix(in srgb,rgb(196 216 247/.7) calc(100*1%),rgb(216 227 248/.7)) 0%,#e6e9f8b3 50%)',
      ),
    ).toEqual({
      angle: 160,
      stops: [
        { colours: ['rgb(196 216 247/.7)', 'rgb(216 227 248/.7)'], share: 1, offset: 0 },
        { colours: ['#e6e9f8b3'], share: 1, offset: 0.5 },
      ],
    })
  })

  it('leaves the offset null where a stop has none', () => {
    expect(parseGradient('linear-gradient(10deg, #abc, #102030 50%)')?.stops).toEqual([
      { colours: ['#abc'], share: 1, offset: null },
      { colours: ['#102030'], share: 1, offset: 0.5 },
    ])
  })

  it('refuses what is not a linear gradient at an angle in degrees', () => {
    expect(parseGradient('')).toBeNull()
    expect(parseGradient('#ffffff')).toBeNull()
    expect(parseGradient('linear-gradient(to right, #fff 0%, #000 100%)')).toBeNull()
    expect(parseGradient('linear-gradient(160deg, #fff 0%')).toBeNull()
    expect(parseGradient('linear-gradient(160deg, #fff 0%, )')).toBeNull()
  })

  it("reads every theme backdrop in Devot's tokens", () => {
    const backdrops = [...readRepoFile('src/theme/tokens.css').matchAll(/--backdrop: ([^;]+);/g)]
    expect(backdrops.length).toBeGreaterThan(8)
    for (const [, value] of backdrops) {
      expect(parseGradient(value ?? '')?.stops.length, value).toBe(3)
    }
  })
})
