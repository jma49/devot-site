import { describe, expect, it } from 'vitest'
import { SLOTS } from '../../src/media.ts'
import { edgesOf } from '../../scripts/media/manifest.ts'
import { CUTS, frameRect, SCENES, type Scene } from '../../scripts/media/scenes.ts'

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

  it.runIf(shape === 'wide')('shows about half the window width on a wide card', () => {
    expect(clip.width / viewport.width).toBeLessThanOrEqual(0.52)
  })

  it.runIf(shape === 'narrow')('shows at most 45 % of the window width on a narrow card', () => {
    expect(clip.width / viewport.width).toBeLessThanOrEqual(0.45)
  })

  it.runIf(phone !== undefined && shape !== 'wide')(
    'cuts phones a part of the same frames at the same shape',
    () => {
      expect(inside(phone!.rect, clip)).toBe(true)
      expect(Math.abs(ratio(phone!.output) - ratio(output))).toBeLessThan(0.005)
    },
  )

  it.runIf(shape === 'wide')(
    "gives phones the narrow cards' cut, so every card's media is as tall there",
    () => {
      expect(phone!.rect).toMatchObject(CUTS.narrow.clip)
      expect(inside(phone!.rect, { x: 0, y: 0, ...viewport })).toBe(true)
    },
  )

  it('takes each frame of the window once, for the clip and its phone cut', () => {
    const frames = frameRect(scene!)
    const cuts = phone && !phone.fill ? [clip, phone.rect] : [clip]
    expect(cuts.every((part) => inside(part, frames))).toBe(true)
    expect(inside(frames, { x: 0, y: 0, ...viewport })).toBe(true)
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

describe('frameRect', () => {
  const output = { width: 800, height: 1000 }
  const clip = { x: 100, y: 0, width: 640, height: 400 }

  it('is the clip when there is no phone cut, or it lies inside the clip', () => {
    expect(frameRect({ clip })).toEqual(clip)
    expect(
      frameRect({ clip, phone: { rect: { x: 200, y: 0, width: 400, height: 250 }, output } }),
    ).toEqual(clip)
  })

  it('reaches past the clip to take in a phone cut of another shape', () => {
    const phone = { rect: { x: 60, y: 0, width: 400, height: 500 }, output }
    expect(frameRect({ clip, phone })).toEqual({ x: 60, y: 0, width: 680, height: 500 })
  })

  it('is the clip for a phone cut that fills the rest of the frame', () => {
    const phone = { rect: { x: 0, y: 0, width: 400, height: 500 }, output, fill: true }
    expect(frameRect({ clip, phone })).toEqual(clip)
  })
})
