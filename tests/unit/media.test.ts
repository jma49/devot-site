import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { media, SLOTS, slotPaths } from '../../src/media.ts'
import { REPO } from '../support/source-files.ts'

// The contract between the page and its product media: src/media.ts names every slot, and
// public/media/<slot>/ holds <slot>.mp4, <slot>.webm and <slot>-poster.webp at the size it states.

const publicFile = (path: string) => join(REPO, 'public', path)
const bytes = (path: string) => statSync(publicFile(path)).size
const KB = 1024

it('lists the hero, the three features and six cards', () => {
  expect([...SLOTS]).toEqual([
    'hero',
    'write',
    'organise',
    'find',
    'card-1',
    'card-2',
    'card-3',
    'card-4',
    'card-5',
    'card-6',
  ])
  expect(Object.keys(media)).toEqual([...SLOTS])
})

it('keeps nothing but the listed slots under public/media', () => {
  expect(readdirSync(publicFile('media')).toSorted()).toEqual([...SLOTS].toSorted())
})

describe.each(SLOTS)('slot %s', (name) => {
  const slot = media[name]
  const paths = slotPaths(name)

  it('states even pixel dimensions, a duration and its text alternative', () => {
    expect(slot.name).toBe(name)
    expect(slot.width % 2).toBe(0)
    expect(slot.height % 2).toBe(0)
    expect(slot.duration).toBeGreaterThan(0)
    expect(slot.alt).toBe(en.media[name])
    expect(slot.alt.trim().split(/\s+/).length).toBeGreaterThanOrEqual(5)
  })

  it('names its poster and sources by the folder convention, MP4 first', () => {
    expect(paths).toEqual({
      mp4: `/media/${name}/${name}.mp4`,
      webm: `/media/${name}/${name}.webm`,
      poster: `/media/${name}/${name}-poster.webp`,
    })
    expect(slot.poster).toBe(paths.poster)
    expect(slot.sources).toEqual([
      { src: paths.mp4, type: 'video/mp4' },
      { src: paths.webm, type: 'video/webm' },
    ])
  })

  it('has a WebP poster at the stated size, under 80 KB', async () => {
    const meta = await sharp(publicFile(paths.poster)).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', slot.width, slot.height])
    expect(bytes(paths.poster)).toBeLessThan(80 * KB)
  })

  it.runIf(slot.clip)('has an MP4 and a WebM clip within the size budget', () => {
    const mp4 = readFileSync(publicFile(paths.mp4))
    const webm = readFileSync(publicFile(paths.webm))
    expect(mp4.subarray(4, 8).toString('latin1')).toBe('ftyp')
    expect([...webm.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
    const hero = name === 'hero'
    expect(hero ? mp4.length + webm.length : Math.max(mp4.length, webm.length)).toBeLessThan(
      (hero ? 2048 : 700) * KB,
    )
  })

  it.runIf(!slot.clip)('is a still, so it ships no clip files', () => {
    expect(readdirSync(publicFile(`media/${name}`))).toEqual([`${name}-poster.webp`])
  })
})
