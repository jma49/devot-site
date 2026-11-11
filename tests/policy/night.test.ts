import { expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'
import { GENERATED_TOKENS } from '../support/style-policy.ts'

// The home page wears the night whatever the reader's scheme: its root carries data-scope="dark"
// with Devot's data-appearance-preview. A media query cannot see that, so every rule a stylesheet
// has for a dark page needs the same rule for a part that wears the night.

const DARK = /@media \(prefers-color-scheme: dark\)( and [^{]+)?\s*\{/g
const SCOPE = "[data-scope='dark']"

const tidy = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()

/** The text between the brace at `open` and the one that closes it. */
function block(css: string, open: number): string {
  let depth = 0
  for (let at = open; at < css.length; at++) {
    if (css[at] === '{') depth++
    else if (css[at] === '}' && --depth === 0) return css.slice(open + 1, at)
  }
  throw new Error('E_NIGHT_BRACES unbalanced braces')
}

/** The rules directly inside a block: selector and declarations. */
function rules(css: string): [selector: string, body: string][] {
  const found: [string, string][] = []
  let from = 0
  for (;;) {
    const open = css.indexOf('{', from)
    if (open < 0) return found
    const body = block(css, open)
    found.push([css.slice(from, open).trim(), body.trim()])
    from = open + body.length + 2
  }
}

/**
 * A selector for a dark page, as a part that wears the night needs it. In a component's scoped
 * style the part is outside the component, so it is named with :global().
 */
export function nightSelector(selector: string, scoped = false): string {
  const scope = scoped ? `:global(${SCOPE})` : SCOPE
  return selector
    .split(',')
    .map((one) => one.trim())
    .map((one) => {
      if (one.startsWith(':global(:root)')) return `:global(${SCOPE})${one.slice(14)}`
      if (one.startsWith(':root')) return `${SCOPE}${one.slice(5)}`
      return `${scope} ${one}`
    })
    .join(', ')
}

/** The dark-page rules of a stylesheet that have no rule for the night beside them. */
export function unmirrored(css: string, scoped = false): string[] {
  const whole = tidy(css)
  const missing: string[] = []
  for (const match of css.matchAll(DARK)) {
    const inner = block(css, match.index + match[0].length - 1)
    for (const [selector, body] of rules(inner.replace(/\/\*[\s\S]*?\*\//g, ''))) {
      const mirror = tidy(`${nightSelector(selector, scoped)} { ${body} }`)
      if (!whole.includes(mirror)) missing.push(selector.replace(/\s+/g, ' '))
    }
  }
  return missing
}

it('gives the night every rule a stylesheet has for a dark page', () => {
  const sheets = filesUnder('src').filter(
    (file) => /\.(css|astro)$/.test(file) && file !== GENERATED_TOKENS,
  )
  const offenders = sheets.flatMap((file) =>
    unmirrored(readRepoFile(file), file.endsWith('.astro')).map(
      (selector) => `${file}: ${selector}`,
    ),
  )
  expect(sheets.length).toBeGreaterThan(10)
  expect(offenders).toEqual([])
})

it('finds a dark rule with no rule for the night, and takes one that has it', () => {
  const dark = `@media (prefers-color-scheme: dark) {
  :root {
    --x: 1;
  }

  .mark,
  .pill {
    opacity: 0.5;
  }
}`
  expect(unmirrored(dark)).toEqual([':root', '.mark, .pill'])
  expect(
    unmirrored(`${dark}
[data-scope='dark'] {
  --x: 1;
}
[data-scope='dark'] .mark,
[data-scope='dark'] .pill {
  opacity: 0.5;
}`),
  ).toEqual([])
  expect(
    unmirrored(`${dark}
[data-scope='dark'] {
  --x: 2;
}`),
  ).toEqual([':root', '.mark, .pill'])
})

it('reads a scoped component style and a query with a second condition', () => {
  expect(nightSelector(':global(:root)', true)).toBe(":global([data-scope='dark'])")
  expect(nightSelector('.mark, .pill', true)).toBe(
    ":global([data-scope='dark']) .mark, :global([data-scope='dark']) .pill",
  )
  expect(
    unmirrored(`@media (prefers-color-scheme: dark) and (max-width: 639.98px) {
  .hero {
    --y: 2;
  }
}
@media (max-width: 639.98px) {
  [data-scope='dark'] .hero {
    --y: 2;
  }
}`),
  ).toEqual([])
})
