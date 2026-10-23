import { expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// The minifier folds `animation` and `animation-timeline` into one shorthand that Chromium and
// WebKit reject, which silently drops the whole declaration; only the built CSS shows it.

const sheets = filesUnder('dist/_astro').filter((file) => file.endsWith('.css'))
const rules = sheets.flatMap((sheet) =>
  [
    ...readRepoFile(sheet).matchAll(
      /([^{}]+)\{([^{}]*animation-timeline[^{}]*|[^{}]*(?:view|scroll)\(\)[^{}]*)\}/g,
    ),
  ].map((match) => ({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' })),
)

it('writes every scroll-driven animation in the build as longhands', () => {
  expect(rules.length).toBeGreaterThanOrEqual(6)
  for (const { selector, body } of rules)
    expect(body, selector).not.toMatch(/(?:^|;)animation:[^;]*(?:view|scroll)\(/)
  const timed = rules.filter((rule) => /animation-timeline:(?:view|scroll)\(/.test(rule.body))
  for (const { selector, body } of timed) expect(body, selector).toMatch(/animation-name:/)
})

it('builds the scroll utilities and the section effects that use them', () => {
  const selectors = rules.map(({ selector }) => selector).join('\n')

  for (const part of [/data-scroll=['"]?rise/, /data-scroll=['"]?drift/, /\.local/, /\.closing/])
    expect(selectors).toMatch(part)
})
