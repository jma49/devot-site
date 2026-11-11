import { expect, it } from 'vitest'
import { readRepoFile } from '../support/source-files.ts'

const css = readRepoFile('src/styles/site-tokens.css')

/** The declarations of the first rule that follows `opening`, by property. */
function declarations(opening: string): Map<string, string> {
  const start = css.indexOf(opening)
  if (start < 0) throw new Error(`site-tokens.css has no ${opening}`)
  const from = css.indexOf('{', start + opening.length - 1) + 1
  const body = css.slice(from, css.indexOf('}', from))
  return new Map(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name = '', value = '']) => [
      name,
      value.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim(),
    ]),
  )
}

it('works every site variable out again inside a scope', () => {
  expect(css).toMatch(/^:root,\n\[data-scope\] \{/m)
})

it('gives a dark scope the values a dark page has', () => {
  const page = declarations('@media (prefers-color-scheme: dark) {\n  :root {')
  const scope = declarations("[data-scope='dark'] {")
  expect(page.size).toBeGreaterThan(4)
  expect([...scope]).toEqual([...page])
})
