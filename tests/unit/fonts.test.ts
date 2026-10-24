import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { filesUnder, readRepoFile, REPO } from '../support/source-files.ts'
import { readWebfont } from '../support/woff2.ts'

const FONT_BUDGET = 40 * 1024
const fontsCss = readRepoFile('src/styles/fonts.css')
const faces = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1] ?? '')
const webfonts = faces.filter((face) => /url\(/.test(face))
const fontFiles = filesUnder('public/fonts').filter((file) => file.endsWith('.woff2'))
const fonts = fontFiles.map((file) => ({ file, font: readWebfont(readFileSync(join(REPO, file))) }))

const tokens = readRepoFile('src/styles/site-tokens.css')
const tierWeights = ['display', 'section'].map((tier) =>
  Number(new RegExp(`--site-type-${tier}-weight:\\s*(\\d+);`).exec(tokens)?.[1]),
)

const catalogText = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(catalogText)
      : []
const BASIC_LATIN = Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i)
const catalogPunctuation = [...new Set(catalogText(en).join(''))]
  .filter((char) => /[\p{P}\p{Zs}]/u.test(char))
  .map((char) => char.codePointAt(0) ?? 0)

describe('webfonts', () => {
  it('serves every face from a woff2 file under public/fonts, and nothing more', () => {
    const urls = webfonts.map((face) => /url\('([^']+)'\)/.exec(face)?.[1])
    expect(urls.map((url) => `public${url}`).toSorted()).toEqual(fontFiles.toSorted())
  })

  it(`keeps the files within ${FONT_BUDGET / 1024} KB together`, () => {
    const total = fontFiles.reduce((sum, file) => sum + statSync(join(REPO, file)).size, 0)
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(FONT_BUDGET)
  })

  it('varies only in weight, across the weights the headings use', () => {
    const [low, high] = [Math.min(...tierWeights), Math.max(...tierWeights)]
    expect(tierWeights.every(Number.isFinite)).toBe(true)
    for (const { file, font } of fonts) {
      // Without STAT, WebKit draws every weight at the axis minimum.
      expect(font.tables.has('STAT'), file).toBe(true)
      expect(
        font.axes.map(({ tag, min, max }) => ({ tag, min, max })),
        file,
      ).toEqual([{ tag: 'wght', min: low, max: high }])
    }
    for (const face of webfonts) expect(face).toContain(`font-weight: ${low} ${high};`)
  })

  it('covers Basic Latin and every punctuation mark and space in the catalog', () => {
    expect(catalogPunctuation.filter((code) => code > 0x7e).length).toBeGreaterThan(0)
    for (const { file, font } of fonts) {
      const missing = [...BASIC_LATIN, ...catalogPunctuation].filter(
        (code) => !font.codePoints.has(code),
      )
      expect(
        missing.map((code) => `U+${code.toString(16).toUpperCase()}`),
        file,
      ).toEqual([])
    }
  })

  it('ships the licence beside the files', () => {
    expect(readRepoFile('public/fonts/OFL.txt')).toContain('SIL Open Font License, Version 1.1')
  })

  it('swaps in each face once loaded, over a fallback sized to its metrics', () => {
    for (const face of webfonts) expect(face).toMatch(/font-display:\s*swap;/)
    const fallbacks = faces.filter((face) => /local\(/.test(face))
    expect(fallbacks).toHaveLength(2)
    for (const face of fallbacks) {
      expect(face).toMatch(/font-family:\s*'Fraunces Fallback';/)
      for (const metric of ['size-adjust', 'ascent-override', 'descent-override']) {
        expect(face).toMatch(new RegExp(`${metric}:\\s*[\\d.]+%;`))
      }
    }
  })

  it('preloads every file the page paints its headline with', () => {
    const layout = readRepoFile('src/layouts/Base.astro')
    for (const file of fontFiles) {
      expect(layout).toContain(`href="${file.replace(/^public/, '')}"`)
    }
  })
})
