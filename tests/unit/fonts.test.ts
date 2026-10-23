import { statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filesUnder, readRepoFile, REPO } from '../support/source-files.ts'

const FONT_BUDGET = 90 * 1024
const fontsCss = readRepoFile('src/styles/fonts.css')
const faces = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1] ?? '')
const webfonts = faces.filter((face) => /url\(/.test(face))
const fontFiles = filesUnder('public/fonts').filter((file) => file.endsWith('.woff2'))

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
