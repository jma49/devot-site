import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { media, SLOTS, variantName } from '../../src/media.ts'
import { mp4Info } from '../../scripts/media/mp4.ts'
import { REPO } from '../support/source-files.ts'

// The manifest says what the captures are: each MP4 has the stated picture size and loop length.

const read = (path: string) => readFileSync(join(REPO, 'public', path))

describe.each(SLOTS.filter((name) => media[name].clip))('clip %s', (name) => {
  it.each(media[name].variants.map((variant) => [variantName(variant), variant] as const))(
    '%s matches the size and length in src/media.json',
    (_, variant) => {
      const info = mp4Info(read(variant.mp4))
      expect([info.width, info.height]).toEqual([variant.width, variant.height])
      expect(Math.abs(info.duration - media[name].duration)).toBeLessThan(0.05)
    },
  )

  it('loops for 4 to 8 seconds on a card, up to 12 for a feature, and longest in the hero', () => {
    const { duration } = media[name]
    const [least, most] = name === 'hero' ? [12, 20] : name.startsWith('card') ? [4, 8] : [4, 12]
    expect(duration).toBeGreaterThanOrEqual(least)
    expect(duration).toBeLessThanOrEqual(most)
  })
})
