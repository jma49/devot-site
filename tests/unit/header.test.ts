import { describe, expect, it } from 'vitest'
import {
  activeSection,
  clearOfClips,
  coveredShare,
  intersect,
  PILL_COVER_LIMIT,
  pillShown,
  trapIndex,
} from '../../src/scripts/header.ts'

describe('activeSection', () => {
  const viewport = 1000
  const sections = [
    { id: 'write', top: 900, bottom: 2500 },
    { id: 'cards', top: 2500, bottom: 3600 },
    { id: 'download', top: 3600, bottom: 4200 },
  ]
  const at = (scroll: number) =>
    activeSection(
      sections.map(({ id, top, bottom }) => ({ id, top: top - scroll, bottom: bottom - scroll })),
      viewport,
    )

  it('is none while the hero holds the reading line', () => {
    expect(at(0)).toBeNull()
    expect(at(400)).toBeNull()
  })

  it('is the section that crosses the reading line at 40 % of the viewport', () => {
    expect(at(600)).toBe('write')
    expect(at(2099)).toBe('write')
    expect(at(2100)).toBe('cards')
    expect(at(3300)).toBe('download')
  })

  it('is none past the last section', () => {
    expect(at(4000)).toBeNull()
  })
})

describe('pillShown', () => {
  const viewport = 900

  it('waits until the hero call to action has scrolled out above the viewport', () => {
    expect(pillShown({ ctaBottom: 420, closingTop: 4000, viewport })).toBe(false)
    expect(pillShown({ ctaBottom: 1, closingTop: 4000, viewport })).toBe(false)
    expect(pillShown({ ctaBottom: -1, closingTop: 4000, viewport })).toBe(true)
  })

  it('gives way as soon as any of the closing section is on screen, and stays away past it', () => {
    expect(pillShown({ ctaBottom: -3000, closingTop: 901, viewport })).toBe(true)
    expect(pillShown({ ctaBottom: -3000, closingTop: 900, viewport })).toBe(false)
    expect(pillShown({ ctaBottom: -3000, closingTop: 899, viewport })).toBe(false)
    expect(pillShown({ ctaBottom: -3000, closingTop: -200, viewport })).toBe(false)
    expect(pillShown({ ctaBottom: -3000, closingTop: -5000, viewport })).toBe(false)
  })

  it('shows after the hero when the page has no closing call to action', () => {
    expect(pillShown({ ctaBottom: -10, closingTop: null, viewport })).toBe(true)
  })
})

describe('trapIndex', () => {
  it('moves on and back, wrapping at both ends', () => {
    expect(trapIndex(4, 0, false)).toBe(1)
    expect(trapIndex(4, 3, false)).toBe(0)
    expect(trapIndex(4, 0, true)).toBe(3)
    expect(trapIndex(4, 2, true)).toBe(1)
  })

  it('starts at the first or last item when focus is outside the trap', () => {
    expect(trapIndex(4, -1, false)).toBe(0)
    expect(trapIndex(4, -1, true)).toBe(3)
  })
})

describe('intersect', () => {
  it('is the overlap of every box, or null when they do not all meet', () => {
    const a = { left: 0, top: 0, right: 100, bottom: 100 }
    const b = { left: 50, top: 20, right: 150, bottom: 80 }
    const c = { left: 60, top: 0, right: 70, bottom: 30 }

    expect(intersect(a, b)).toEqual({ left: 50, top: 20, right: 100, bottom: 80 })
    expect(intersect(a, b, c)).toEqual({ left: 60, top: 20, right: 70, bottom: 30 })
    expect(intersect(a, { left: 100, top: 0, right: 200, bottom: 100 })).toBeNull()
    expect(intersect(a, { left: 0, top: 120, right: 100, bottom: 200 })).toBeNull()
  })
})

describe('coveredShare', () => {
  const view = { left: 0, top: 0, right: 1440, bottom: 900 }
  const pill = { left: 1230, top: 828, right: 1416, bottom: 876 }

  it('is the share of a clip the pill would cover', () => {
    const clip = { left: 880, top: 400, right: 1296, bottom: 900 }
    // 66 x 48 of 416 x 500
    expect(coveredShare(pill, [clip], view)).toBeCloseTo((66 * 48) / (416 * 500), 6)
  })

  it('counts only the part of a clip that is on screen', () => {
    const entering = { left: 880, top: 850, right: 1296, bottom: 1368 }
    // 66 x 26 of the 416 x 50 that shows
    expect(coveredShare(pill, [entering], view)).toBeCloseTo((66 * 26) / (416 * 50), 6)
  })

  it('is the largest share over every clip, and nothing for clips off screen or clear of it', () => {
    const clear = { left: 100, top: 100, right: 800, bottom: 600 }
    const gone = { left: 880, top: 1000, right: 1296, bottom: 1500 }
    const small = { left: 1200, top: 800, right: 1300, bottom: 900 }

    expect(coveredShare(pill, [], view)).toBe(0)
    expect(coveredShare(pill, [clear, gone], view)).toBe(0)
    expect(coveredShare(pill, [clear, small, gone], view)).toBeCloseTo((70 * 48) / (100 * 100), 6)
  })
})

describe('clearOfClips', () => {
  const view = { left: 0, top: 0, right: 1000, bottom: 1000 }
  const clip = { left: 0, top: 0, right: 1000, bottom: 100 }
  const pillOver = (width: number) => ({ left: 0, top: 0, right: width, bottom: 100 })

  it('holds while the pill covers under 5 % of every clip, and gives way at 5 %', () => {
    expect(PILL_COVER_LIMIT).toBe(0.05)
    expect(clearOfClips(pillOver(49), [clip], view)).toBe(true)
    expect(clearOfClips(pillOver(50), [clip], view)).toBe(false)
    expect(clearOfClips(pillOver(500), [], view)).toBe(true)
  })
})
