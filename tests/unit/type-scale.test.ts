import { describe, expect, it } from 'vitest'
import { readRepoFile } from '../support/source-files.ts'

const TIERS = ['display', 'section', 'card', 'body', 'label', 'caption'] as const
const tokens = readRepoFile('src/styles/site-tokens.css')

/** Stylesheets that set their type only through the scale. */
const SCALED = [
  'src/styles/home/features.css',
  'src/styles/home/cards.css',
  'src/styles/home/privacy.css',
  'src/styles/home/demo.css',
  'src/styles/clip-controls.css',
]

const declarations = (css: string, property: string) =>
  [...css.matchAll(new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;]+);`, 'g'))].map((m) =>
    (m[1] ?? '').trim(),
  )

describe('type scale', () => {
  it('defines each tier’s size and weight once, in site-tokens.css', () => {
    for (const tier of TIERS) {
      for (const part of ['size', 'weight']) {
        const name = `--site-type-${tier}-${part}`
        expect(declarations(tokens, name), name).toHaveLength(1)
      }
    }
  })

  it('documents every tier beside the values', () => {
    const doc = /\/\*[\s\S]*?Type scale[\s\S]*?\*\//.exec(tokens)?.[0] ?? ''
    for (const tier of TIERS) expect(doc, tier).toMatch(new RegExp(`\\b${tier}\\b`))
  })

  it('is the only source of sizes and weights in the section stylesheets', () => {
    const offenders = SCALED.flatMap((file) => {
      const css = readRepoFile(file)
      const sizes = declarations(css, 'font-size').filter(
        (value) =>
          !/^var\(--site-type-[a-z]+-size\)$/.test(value) && !/^([\d.]+em|0|inherit)$/.test(value),
      )
      const weights = declarations(css, 'font-weight').filter(
        (value) => !/^var\(--site-type-[a-z]+-weight\)$/.test(value) && value !== 'inherit',
      )
      return [...sizes, ...weights].map((value) => `${file}: ${value}`)
    })
    expect(offenders).toEqual([])
  })
})
