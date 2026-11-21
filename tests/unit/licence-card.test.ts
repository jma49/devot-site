import { describe, expect, it } from 'vitest'
import { MAX_TILT, tiltAt } from '../../src/scripts/licence-card.ts'

describe('licence card tilt', () => {
  it('stays flat with the light in the middle when the pointer is at the centre', () => {
    const tilt = tiltAt(0.5, 0.5)
    expect(tilt.angle).toBe(0)
    expect([tilt.lightX, tilt.lightY]).toEqual([50, 50])
  })

  it('leans at most MAX_TILT degrees, at the edge and beyond it', () => {
    expect(tiltAt(1, 0.5).angle).toBeCloseTo(MAX_TILT)
    expect(tiltAt(1, 1).angle).toBeCloseTo(MAX_TILT)
    expect(tiltAt(4, -3).angle).toBeCloseTo(MAX_TILT)
    expect(MAX_TILT).toBeLessThanOrEqual(8)
  })

  it('turns about the axis across the pointer, so the right edge comes forward for a pointer on the right', () => {
    const right = tiltAt(1, 0.5)
    expect(right.axisX).toBeCloseTo(0)
    expect(right.axisY).toBeCloseTo(1)
    const below = tiltAt(0.5, 1)
    expect(below.axisX).toBeCloseTo(-1)
    expect(below.axisY).toBeCloseTo(0)
  })

  it('puts the light under the pointer, clamped to the card', () => {
    expect(tiltAt(0.25, 0.75)).toMatchObject({ lightX: 25, lightY: 75 })
    expect(tiltAt(-1, 2)).toMatchObject({ lightX: 0, lightY: 100 })
  })
})
