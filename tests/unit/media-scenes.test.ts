import { describe, expect, it } from 'vitest'
import { SLOTS } from '../../src/media.ts'
import { edgesOf } from '../../scripts/media/manifest.ts'
import { CUTS, SCENES, type Scene } from '../../scripts/media/scenes.ts'

// The cut each clip takes of the Devot window: a region of it, as large on the page as the app
// needs to stay legible, the same shape for every slot of a kind, and a phone cut inside it.

const scenes = SLOTS.map((slot) => [slot, SCENES[slot]] as const)
const ratio = ({ width, height }: { width: number; height: number }) => width / height
const inside = (inner: Scene['clip'], outer: Scene['clip']) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height

it('has a scene for every slot', () => {
  expect(scenes.filter(([, scene]) => !scene).map(([slot]) => slot)).toEqual([])
})

describe.each(scenes)('%s', (slot, scene) => {
  const { viewport, clip, output, phone, shape } = scene!

  it('cuts a region of the window that keeps its top edge', () => {
    expect(inside(clip, { x: 0, y: 0, ...viewport })).toBe(true)
    expect(edgesOf(clip, viewport)).toContain('top')
  })

  it.runIf(shape !== 'hero')(
    'takes the cut of its shape and encodes it at twice its points',
    () => {
      const size = shape === 'hero' ? clip : CUTS[shape].clip
      expect({ width: clip.width, height: clip.height }).toEqual(size)
      expect(output).toEqual({ width: clip.width * 2, height: clip.height * 2 })
    },
  )

  it.runIf(shape === 'wide')('shows at most 65 % of the window width on a wide card', () => {
    expect(clip.width / viewport.width).toBeLessThanOrEqual(0.65)
  })

  it.runIf(shape === 'narrow')('shows at most 45 % of the window width on a narrow card', () => {
    expect(clip.width / viewport.width).toBeLessThanOrEqual(0.45)
  })

  it.runIf(phone !== undefined)('cuts phones a part of the same frames at the same shape', () => {
    expect(inside(phone!.rect, clip)).toBe(true)
    expect(Math.abs(ratio(phone!.output) - ratio(output))).toBeLessThan(0.005)
  })

  it.runIf(phone !== undefined && !phone.fill)('encodes the phone cut at twice its points', () => {
    expect(phone!.output).toEqual({ width: phone!.rect.width * 2, height: phone!.rect.height * 2 })
  })

  it.runIf(phone !== undefined && shape === 'wide')(
    'keeps the same window edges on phones, which the card rounds and outlines',
    () => {
      expect(edgesOf(phone!.rect, viewport)).toEqual(edgesOf(clip, viewport))
    },
  )

  it.runIf(shape === 'wide' || shape === 'feature')('gives phones a closer cut', () => {
    expect(phone?.rect.width).toBe(CUTS[shape as 'wide' | 'feature'].phone.width)
  })
})
