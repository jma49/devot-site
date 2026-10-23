import { describe, expect, it } from 'vitest'
import { activeSection, pillShown, trapIndex } from '../../src/scripts/header.ts'

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
