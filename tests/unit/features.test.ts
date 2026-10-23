import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { SLOTS } from '../../src/media.ts'
import {
  ACTIVE_LINE,
  activeIndex,
  followScroll,
  progressPast,
  scrollTarget,
} from '../../src/scripts/features.ts'

// Block tops are viewport coordinates, as getBoundingClientRect gives them; the line sits at
// ACTIVE_LINE of a 1000 px viewport.
const line = ACTIVE_LINE * 1000

describe('activeIndex', () => {
  it('keeps the first item active until any block reaches the line', () => {
    expect(activeIndex([900, 1600, 2300], line)).toBe(0)
  })

  it('makes a block active once its top crosses the line', () => {
    expect(activeIndex([-300, line + 1, 1100], line)).toBe(0)
    expect(activeIndex([-301, line, 1100], line)).toBe(1)
    expect(activeIndex([-1200, -500, line - 1], line)).toBe(2)
  })

  it('gives the item back when scrolling up moves the block below the line again', () => {
    const down = activeIndex([-700, line - 20, 1100], line)
    const up = activeIndex([-660, line + 20, 1140], line)

    expect([down, up]).toEqual([1, 0])
  })

  it('keeps the last item active after every block has passed', () => {
    expect(activeIndex([-3000, -2300, -1600], line)).toBe(2)
  })

  it('has no active item without blocks', () => {
    expect(activeIndex([], line)).toBe(-1)
  })
})

describe('progressPast', () => {
  const heights = [500, 500, 500]

  it('is 0 for blocks below the line and 1 for blocks the next one has taken over from', () => {
    expect(progressPast([line, 1100, 1800], heights, line)).toEqual([0, 0, 0])
    expect(progressPast([-700, line, 1100], heights, line)).toEqual([1, 0, 0])
  })

  it('runs from one block top to the next, so the rail fills without a gap', () => {
    const [first] = progressPast([line - 175, line + 525, line + 1225], heights, line)

    expect(first).toBeCloseTo(0.25)
  })

  it('measures the last block by its own height', () => {
    const last = progressPast([-1400, -700, line - 250], heights, line)[2]

    expect(last).toBeCloseTo(0.5)
  })

  it('runs both ways: the same position gives the same value', () => {
    const tops = [line - 350, line + 350, line + 1050]

    expect(progressPast(tops, heights, line)).toEqual(progressPast([...tops], heights, line))
    expect(progressPast(tops, heights, line)[0]).toBeCloseTo(0.5)
  })
})

describe('scrollTarget', () => {
  it('centres a block that fits, which puts its top above the line', () => {
    const target = scrollTarget({ top: 1500, height: 400 }, 1000, 2000)

    expect(target).toBe(2000 + 1500 - 300)
    expect(1500 - (target - 2000)).toBeLessThan(line)
  })

  it('keeps a short block’s top just above the line, so it becomes the active one', () => {
    const target = scrollTarget({ top: -200, height: 100 }, 1000, 3000)
    const topAfter = -200 - (target - 3000)

    expect(topAfter).toBeLessThan(line)
    expect(topAfter).toBeGreaterThan(line - 80)
  })

  it('shows the top of a block taller than the viewport, clear of the header', () => {
    const target = scrollTarget({ top: 600, height: 1400 }, 1000, 0)
    const topAfter = 600 - target

    expect(topAfter).toBeGreaterThan(80)
    expect(topAfter).toBeLessThan(line)
  })

  it('never asks for a position above the top of the page', () => {
    expect(scrollTarget({ top: 100, height: 300 }, 1000, 0)).toBe(0)
  })
})

describe('followScroll', () => {
  it('follows the scroll when no item was chosen', () => {
    expect(followScroll(2, null, 0)).toEqual({ index: 2, hold: null })
  })

  it('holds a chosen item while the page scrolls past the ones between', () => {
    const hold = { index: 2, until: 1000 }

    expect(followScroll(1, hold, 400)).toEqual({ index: 2, hold })
  })

  it('lets go once the scroll arrives at the chosen item', () => {
    expect(followScroll(2, { index: 2, until: 1000 }, 500)).toEqual({ index: 2, hold: null })
  })

  it('lets go when the time is up, whatever the scroll reached', () => {
    expect(followScroll(1, { index: 2, until: 1000 }, 1000)).toEqual({ index: 1, hold: null })
  })
})

describe('feature copy', () => {
  const text = (body: (string | { code: string })[]) =>
    body.map((part) => (typeof part === 'string' ? part : part.code)).join('')

  it('covers write, organise and find, each with media of its own', () => {
    expect(en.features.items.map((item) => item.slot)).toEqual(['write', 'organise', 'find'])
    for (const { slot } of en.features.items) expect(SLOTS).toContain(slot)
  })

  it('keeps each description to two or three sentences and at most 40 words', () => {
    for (const { body } of en.features.items) {
      const words = text(body).trim().split(/\s+/)
      const sentences = text(body)
        .split(/[.!?](?:\s|$)/)
        .filter((s) => s.trim())
      expect(words.length).toBeLessThanOrEqual(40)
      expect(sentences.length).toBeGreaterThanOrEqual(2)
      expect(sentences.length).toBeLessThanOrEqual(3)
    }
  })

  it('names the heading lines as the section label', () => {
    expect(en.features.label).toBe(en.features.titleLines.join(' '))
  })
})
