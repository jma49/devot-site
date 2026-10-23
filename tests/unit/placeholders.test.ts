import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import {
  ffmpegArgs,
  generatePlaceholders,
  paletteFrom,
  renderPoster,
} from '../../scripts/placeholders/generate.ts'
import { media, slotPaths, SLOTS } from '../../src/media.ts'
import { readRepoFile } from '../support/source-files.ts'
import { tempDir } from '../support/temp-dirs.ts'

const palette = paletteFrom(readRepoFile('src/theme/tokens.css'))
const hex = /^#[0-9a-f]{6}$/i

it('takes the placeholder colours from the design tokens', () => {
  expect(Object.values(palette).every((colour) => hex.test(colour))).toBe(true)
})

it('renders a poster at the slot size as a small WebP', async () => {
  for (const name of ['hero', 'card-2', 'card-4'] as const) {
    const poster = await renderPoster(media[name], palette)
    const meta = await sharp(poster).metadata()
    expect([meta.format, meta.width, meta.height], name).toEqual([
      'webp',
      media[name].width,
      media[name].height,
    ])
    expect(poster.length, name).toBeLessThan(20_000)
  }
})

it('builds ffmpeg arguments that loop the poster for the slot duration, one per format', () => {
  const slot = media.hero
  const mp4 = ffmpegArgs('in.webp', 'out.mp4', slot, 'mp4')
  const webm = ffmpegArgs('in.webp', 'out.webm', slot, 'webm')
  expect(mp4).toContain('libx264')
  expect(mp4.at(-1)).toBe('out.mp4')
  expect(webm).toContain('libvpx-vp9')
  expect(webm.at(-1)).toBe('out.webm')
  for (const args of [mp4, webm]) {
    expect(args.slice(args.indexOf('-i'), args.indexOf('-i') + 2)).toEqual(['-i', 'in.webp'])
    expect(args.slice(args.indexOf('-t'), args.indexOf('-t') + 2)).toEqual([
      '-t',
      String(slot.duration),
    ])
    expect(args).toContain('-an')
  }
})

it('writes every missing file and leaves existing ones alone unless forced', async () => {
  const publicDir = tempDir('site-placeholders-')
  const slots = [media.hero, media['card-2']]
  const encoded: string[] = []
  const encode = (args: string[]) => {
    const out = args.at(-1) as string
    encoded.push(out)
    writeFileSync(out, 'clip')
  }

  const first = await generatePlaceholders({ publicDir, palette, slots, encode })
  const all = slots.flatMap(({ name }) => Object.values(slotPaths(name)))
  expect(first.toSorted()).toEqual(all.toSorted())
  expect(all.every((path) => existsSync(join(publicDir, path)))).toBe(true)
  expect(encoded).toHaveLength(4)

  const real = join(publicDir, slotPaths('hero').mp4)
  writeFileSync(real, 'real capture')
  expect(await generatePlaceholders({ publicDir, palette, slots, encode })).toEqual([])

  const forced = await generatePlaceholders({ publicDir, palette, slots, encode, force: true })
  expect(forced).toHaveLength(all.length)
})

it('covers every slot of the manifest', () => {
  expect(Object.keys(media).toSorted()).toEqual([...SLOTS].toSorted())
})
