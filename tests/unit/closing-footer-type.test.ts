import { expect, it } from 'vitest'
import { readRepoFile } from '../support/source-files.ts'

// The same rule tests/unit/type-scale.test.ts holds the section stylesheets to.
const STYLESHEETS = [
  'src/styles/home/closing.css',
  'src/styles/footer.css',
  'src/styles/install-note.css',
]

const declarations = (css: string, property: string) =>
  [...css.matchAll(new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;]+);`, 'g'))].map((m) =>
    (m[1] ?? '').trim(),
  )

it('sets the closing, the footer and the install note in the type scale only', () => {
  const offenders = STYLESHEETS.flatMap((file) => {
    const css = readRepoFile(file)
    const sizes = declarations(css, 'font-size').filter(
      (value) => !/^var\(--site-type-[a-z]+-size\)$/.test(value) && value !== 'inherit',
    )
    const weights = declarations(css, 'font-weight').filter(
      (value) => !/^var\(--site-type-[a-z]+-weight\)$/.test(value) && value !== 'inherit',
    )
    const families = declarations(css, 'font-family')
    return [...sizes, ...weights, ...families].map((value) => `${file}: ${value}`)
  })
  expect(offenders).toEqual([])
})
