import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import type { Measured } from '../../src/media.ts'
import { edgesOf, serializeManifest, withEntry } from '../../scripts/media/manifest.ts'
import { REPO } from '../support/source-files.ts'
import { tempDir } from '../support/temp-dirs.ts'

const entry = (duration: number, extra: Partial<Measured> = {}): Measured => ({
  width: 1408,
  height: 880,
  points: 704,
  minText: 10,
  duration,
  posterTime: 2,
  edges: ['top', 'left'],
  bytes: { light: { mp4: 3, webm: 2, poster: 1 } },
  ...extra,
})

it('names the window edges a clip keeps; the other sides are cuts', () => {
  const viewport = { width: 1280, height: 800 }
  expect(edgesOf({ x: 0, y: 0, width: 1280, height: 800 }, viewport)).toEqual([
    'top',
    'right',
    'bottom',
    'left',
  ])
  expect(edgesOf({ x: 0, y: 0, width: 900, height: 565 }, viewport)).toEqual(['top', 'left'])
  expect(edgesOf({ x: 380, y: 0, width: 900, height: 565 }, viewport)).toEqual(['top', 'right'])
  expect(edgesOf({ x: 200, y: 40, width: 900, height: 565 }, viewport)).toEqual([])
})

it('adds or replaces one slot and keeps the slots in manifest order', () => {
  const order = ['hero', 'write', 'card-1'] as const
  const both = withEntry(withEntry({}, 'card-1', entry(6), order), 'hero', entry(16.7), order)
  expect(Object.keys(both)).toEqual(['hero', 'card-1'])
  expect(withEntry(both, 'card-1', entry(7), order)['card-1']?.duration).toBe(7)
})

it('writes the manifest as the formatter would, so a capture leaves no format diff', () => {
  const text = serializeManifest({
    'card-1': entry(7.5, { phone: { width: 800, height: 500, points: 400, minText: 10 } }),
    'card-2': entry(6.1, { edges: [] }),
  })
  expect(text.split('\n').slice(0, 9)).toEqual([
    '{',
    '  "card-1": {',
    '    "width": 1408,',
    '    "height": 880,',
    '    "points": 704,',
    '    "minText": 10,',
    '    "duration": 7.5,',
    '    "posterTime": 2,',
    '    "edges": ["top", "left"],',
  ])
  expect(text).toContain('    "edges": [],\n')
  const file = join(tempDir('manifest-'), 'media.json')
  writeFileSync(file, text)
  const formatter = join(REPO, 'node_modules', '.bin', 'oxfmt')
  expect(() => execFileSync(formatter, ['--check', file], { stdio: 'pipe' })).not.toThrow()
})
