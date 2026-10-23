import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { media, SLOTS, slotPaths } from '../../src/media.ts'
import { mp4Info } from '../../scripts/media/mp4.ts'
import { REPO } from '../support/source-files.ts'

// The manifest says what the captures are: each MP4 has the stated picture size and loop length.

const read = (path: string) => readFileSync(join(REPO, 'public', path))

describe.each(SLOTS.filter((name) => media[name].clip))('clip %s', (name) => {
  it('matches the size and length in src/media.json', () => {
    const info = mp4Info(read(slotPaths(name).mp4))
    expect([info.width, info.height]).toEqual([media[name].width, media[name].height])
    expect(Math.abs(info.duration - media[name].duration)).toBeLessThan(0.05)
  })

  it('loops for 4 to 20 seconds, the hero longest', () => {
    const { duration } = media[name]
    expect(duration).toBeGreaterThanOrEqual(name === 'hero' ? 12 : 4)
    expect(duration).toBeLessThanOrEqual(name === 'hero' ? 20 : 8)
  })
})
