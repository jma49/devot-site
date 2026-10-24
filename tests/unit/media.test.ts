import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import {
  av1Codecs,
  DARK_MEDIA,
  LIGHT_MEDIA,
  media,
  PHONE_MEDIA,
  SLOTS,
  slotPaths,
  variantName,
} from '../../src/media.ts'
import { CUTS, SCENES } from '../../scripts/media/scenes.ts'
import { REPO } from '../support/source-files.ts'

// The contract between the page and its product media: src/media.ts names every slot, and
// public/media/<slot>/ holds each variant's MP4, WebM and WebP poster at the size it states.

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

it('names the light desktop files plainly and marks the dark and phone ones', () => {
  expect(slotPaths('card-1')).toEqual({
    mp4: '/media/card-1/card-1.mp4',
    webm: '/media/card-1/card-1.webm',
    poster: '/media/card-1/card-1-poster.webp',
  })
  expect(slotPaths('card-1', { scheme: 'dark', phone: false }).webm).toBe(
    '/media/card-1/card-1-dark.webm',
  )
  expect(slotPaths('hero', { scheme: 'dark', phone: true }).poster).toBe(
    '/media/hero/hero-phone-dark-poster.webp',
  )
  expect(variantName({ scheme: 'light', phone: true })).toBe('light-phone')
})

it('names main-profile 8-bit AV1 at the level the picture size needs', () => {
  expect(av1Codecs(800, 1000)).toBe('av01.0.05M.08')
  expect(av1Codecs(1408, 880)).toBe('av01.0.08M.08')
  expect(av1Codecs(2048, 1280)).toBe('av01.0.12M.08')
})

describe.each(SLOTS)('slot %s', (name) => {
  const slot = media[name]

  it('states even pixel dimensions, a duration, a poster time and its text alternative', () => {
    expect(slot.name).toBe(name)
    expect(slot.width % 2).toBe(0)
    expect(slot.height % 2).toBe(0)
    expect(slot.duration).toBeGreaterThan(0)
    expect(slot.posterTime).toBeGreaterThan(0)
    expect(slot.posterTime).toBeLessThan(slot.duration)
    expect(slot.alt).toBe(en.media[name])
    expect(slot.alt.trim().split(/\s+/).length).toBeGreaterThanOrEqual(5)
  })

  it('lists its variants most specific first, the light desktop one last and unconditional', () => {
    const queries = slot.variants.map((variant) => variant.media)
    const expected = [
      `${PHONE_MEDIA} and ${DARK_MEDIA}`,
      `${PHONE_MEDIA} and ${LIGHT_MEDIA}`,
      DARK_MEDIA,
      undefined,
    ]
    expect(queries).toEqual(slot.phone ? expected : expected.slice(2))
    expect(slot.variants.at(-1)?.poster).toBe(slot.poster)
  })

  it('names a query for each variant that no other variant matches, for preloads and styles', () => {
    const only = slot.variants.map((variant) => variant.only)
    const expected = [
      `${PHONE_MEDIA} and ${DARK_MEDIA}`,
      `${PHONE_MEDIA} and ${LIGHT_MEDIA}`,
      `(min-width: 640px) and ${DARK_MEDIA}`,
      `(min-width: 640px) and ${LIGHT_MEDIA}`,
    ]
    expect(only).toEqual(slot.phone ? expected : [DARK_MEDIA, LIGHT_MEDIA])
  })

  it('offers AV1 in WebM before H.264 in MP4 for each variant, with its media query', () => {
    expect(slot.sources).toEqual(
      slot.variants.flatMap((variant) => [
        {
          src: variant.webm,
          type: `video/webm; codecs="${av1Codecs(variant.width, variant.height)}"`,
          media: variant.media,
        },
        { src: variant.mp4, type: 'video/mp4', media: variant.media },
      ]),
    )
  })

  // A wide card's phone cut has the narrow cards' shape, which the cards stylesheet gives it.
  it('keeps the phone cut at the shape the page lays it out at', () => {
    if (!slot.phone) return
    const shape = SCENES[name]?.shape === 'wide' ? CUTS.narrow.clip : slot
    expect(
      Math.abs(slot.phone.width / slot.phone.height - shape.width / shape.height),
    ).toBeLessThan(0.005)
    expect(slot.phone.width % 2).toBe(0)
    expect(slot.phone.height % 2).toBe(0)
  })

  it.each(['light', 'dark'] as const)(
    'has %s posters at their sizes, in budget',
    async (scheme) => {
      for (const variant of slot.variants.filter((v) => v.scheme === scheme)) {
        const meta = await sharp(publicFile(variant.poster)).metadata()
        expect([meta.format, meta.width, meta.height]).toEqual([
          'webp',
          variant.width,
          variant.height,
        ])
        const budget = variant.phone ? 50 : name === 'hero' ? 120 : 80
        expect(bytes(variant.poster), variant.poster).toBeLessThan(budget * KB)
      }
    },
  )

  it('has MP4 and WebM files for every variant within the size budget', () => {
    for (const variant of slot.variants) {
      const mp4 = readFileSync(publicFile(variant.mp4))
      const webm = readFileSync(publicFile(variant.webm))
      expect(mp4.subarray(4, 8).toString('latin1')).toBe('ftyp')
      expect([...webm.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
      // The hero's desktop pair shares one budget; any other file has its own.
      const pair = name === 'hero' && !variant.phone
      const size = pair ? mp4.length + webm.length : Math.max(mp4.length, webm.length)
      const limit = name !== 'hero' ? 700 * KB - 1 : variant.phone ? 400 * KB : 2048 * KB - 1
      expect(size, variant.webm).toBeLessThanOrEqual(limit)
    }
  })

  it('records the size of every file in the manifest', () => {
    for (const variant of slot.variants) {
      expect(slot.bytes[variantName(variant)], variantName(variant)).toEqual({
        mp4: bytes(variant.mp4),
        webm: bytes(variant.webm),
        poster: bytes(variant.poster),
      })
    }
  })

  it('ships no file it does not list', () => {
    const listed = slot.variants.flatMap((v) => [v.mp4, v.webm, v.poster])
    const shipped = readdirSync(publicFile(`media/${name}`)).map((file) => `/media/${name}/${file}`)
    expect(shipped.toSorted()).toEqual(listed.toSorted())
  })
})
