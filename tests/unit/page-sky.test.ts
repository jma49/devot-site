import { describe, expect, it } from 'vitest'
import { readRepoFile } from '../support/source-files.ts'

describe('the sky behind the page', () => {
  const template = readRepoFile('src/components/home/PageSky.astro')
  const hero = readRepoFile('src/components/home/Hero.astro')
  const script = readRepoFile('src/scripts/page-sky.ts')

  it('carries a canvas for the shader over its CSS aurora, out of the accessibility tree', () => {
    expect(template).toMatch(
      /<div class="page-sky" aria-hidden="true" data-page-sky data-backdrop="css">/,
    )
    expect(template.indexOf('<Aurora ')).toBeLessThan(template.indexOf('<canvas '))
    expect(template).toContain('data-sky-canvas')
  })

  it('holds the page’s one canvas: the hero shows the same sky and has none of its own', () => {
    expect(template.match(/<canvas /g)).toHaveLength(1)
    expect(hero).not.toMatch(/<canvas/)
    expect(hero).toMatch(/<div class="hero-sky" data-hero-sky>/)
    expect(readRepoFile('src/scripts/hero.ts')).not.toMatch(/hero-backdrop/)
  })

  it('starts one backdrop for the hero and the page, once the page has painted', () => {
    expect(script.match(/startBackdrop\(/g)).toHaveLength(1)
    expect(script).toMatch(/afterFirstPaint\(/)
    expect(script).toMatch(/import\('\.\/hero-backdrop\.ts'\)/)
    expect(script).not.toMatch(/^import .*hero-backdrop/m)
    expect(script).toMatch(/window\.matchMedia\(WEBGL_QUERY\)\.matches/)
  })

  it('draws no shader where the stylesheet hides the sky', () => {
    const [, hidden] = /const NO_SKY_QUERY = '([^']+)'/.exec(script) ?? []
    expect(hidden).toBeDefined()
    expect(script).toContain('!window.matchMedia(NO_SKY_QUERY).matches')
    expect(readRepoFile('src/styles/home/sky.css')).toMatch(
      new RegExp(
        `@media ${hidden?.replace(/[()]/g, '\\$&')} \\{\\s+\\.page-sky \\{\\s+display: none;`,
      ),
    )
  })
})
