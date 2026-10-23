import { expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// The minifier folds `animation` and `animation-timeline` into one shorthand that Chromium and
// WebKit reject, which silently drops the whole declaration; only the built CSS shows it.

const sheets = filesUnder('dist/_astro').filter((file) => file.endsWith('.css'))
const OURS = /\.(local|closing)(__|:|\{|\s|,)/

it('keeps the scroll-driven animations of the local-first and closing sections as longhands', () => {
  const rules = sheets.flatMap((sheet) =>
    [
      ...readRepoFile(sheet).matchAll(
        /([^{}]+)\{([^{}]*animation-timeline[^{}]*|[^{}]*view\(\)[^{}]*)\}/g,
      ),
    ].map((match) => ({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' })),
  )
  const ours = rules.filter(({ selector }) => OURS.test(selector))

  expect(ours.length).toBeGreaterThanOrEqual(3)
  for (const { selector, body } of ours) {
    expect(body, selector).not.toMatch(/(?:^|;)animation:[^;]*(?:view|scroll)\(/)
    expect(body, selector).toMatch(/animation-timeline:view\(\)/)
    expect(body, selector).toMatch(/animation-name:/)
  }
})
