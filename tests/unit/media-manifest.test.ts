import { expect, it } from 'vitest'
import { edgesOf, serializeManifest, withEntry } from '../../scripts/media/manifest.ts'

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
  const first = withEntry(
    {},
    'card-1',
    { width: 1720, height: 1080, duration: 6, edges: [] },
    order,
  )
  const both = withEntry(
    first,
    'hero',
    { width: 2048, height: 1280, duration: 16.7, edges: ['top'] },
    order,
  )
  expect(Object.keys(both)).toEqual(['hero', 'card-1'])
  const replaced = withEntry(
    both,
    'card-1',
    { width: 1720, height: 1080, duration: 7, edges: [] },
    order,
  )
  expect(replaced['card-1']?.duration).toBe(7)
})

it('writes the manifest as the formatter would, so a capture leaves no format diff', () => {
  const text = serializeManifest({
    hero: { width: 2048, height: 1280, duration: 16.7, edges: ['top', 'right', 'bottom', 'left'] },
    'card-2': { width: 860, height: 1080, duration: 6.1, edges: [] },
  })
  expect(text).toBe(
    [
      '{',
      '  "hero": {',
      '    "width": 2048,',
      '    "height": 1280,',
      '    "duration": 16.7,',
      '    "edges": ["top", "right", "bottom", "left"]',
      '  },',
      '  "card-2": {',
      '    "width": 860,',
      '    "height": 1080,',
      '    "duration": 6.1,',
      '    "edges": []',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
})
