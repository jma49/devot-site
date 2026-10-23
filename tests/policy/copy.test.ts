import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { catalogStrings, inlineCopy, pageCopy } from '../support/copy-policy.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// User-facing text lives in src/i18n so another language is one more catalog. tests/built checks
// the built pages too, which also catches text a template builds in its frontmatter.

// Wording the page once used that claimed more than Devot does.
const RETIRED_CLAIMS: { wording: RegExp; why: string }[] = [
  { wording: /any editor/i, why: 'notes are plain files only once the Markdown mirror is on' },
  { wording: /\bnative\b/i, why: 'the window is a macOS window around a web view' },
  { wording: /any shortcut/i, why: 'some keys are reserved for macOS and the app menu' },
  { wording: /still open/i, why: 'there is no open state, only statuses and a status filter' },
  { wording: /^© \d{4} Devot$/, why: 'the licence names the copyright holder' },
  { wording: /^Highlights$/, why: 'a vague navigation label' },
  { wording: /^devot-mcp$/, why: 'devot-mcp runs from a checkout of the source' },
]

it('retires wording that claimed more than Devot does', () => {
  const offenders = [...catalogStrings(en, [2026])].flatMap((text) =>
    RETIRED_CLAIMS.filter(({ wording }) => wording.test(text)).map(({ why }) => `${text} (${why})`),
  )
  expect(offenders).toEqual([])
})

it('templates take their text from src/i18n', () => {
  const templates = filesUnder('src').filter((file) => file.endsWith('.astro'))
  const offenders = templates.flatMap((file) =>
    inlineCopy(readRepoFile(file)).map((text) => `${file}: ${text}`),
  )
  expect(templates.length).toBeGreaterThan(0)
  expect(offenders).toEqual([])
})

describe('inlineCopy', () => {
  it('finds literal text, labels, literal expressions and meta copy', () => {
    const sample = `---
const title = 'Not markup'
---
<head>
  <meta name="description" content="Notes that stay on your Mac" />
  <meta property="og:title" content={t.meta.title} />
  <meta property="og:type" content="website" />
  <meta name="theme-color" content="#fff" />
</head>
<header class="site">
  <a href="/" aria-label="Home">{t.siteName}</a>
  <img src={dove.src} alt="" width="28" />
  <img src={dove.src} alt={t.logo} />
  <p>Hello there</p>
  <p>{t.lead}&nbsp;{' '}</p>
  <a>{'Download for macOS'}</a>
  <p>{\`Hi \${name}\`}</p>
  <p>{\`\${a}\${b}\`}</p>
  <a href={'/path'} class={\`x \${y}\`}>{t.x}</a>
  {items.map((item) => <li>{item.label}</li>)}
</header>
<!-- a comment -->
<script>const x = 'code'</script>
<style>.site { color: var(--a); }</style>
`
    expect(inlineCopy(sample)).toEqual([
      'content="Notes that stay on your Mac"',
      'aria-label="Home"',
      "{'Download for macOS'}",
      '{`Hi ${name}`}',
      'Hello there',
    ])
  })
})

describe('pageCopy', () => {
  it('reads text, labels and the meta copy of a built page, and skips code', () => {
    const html = `<!doctype html><html lang="en"><head>
      <meta charset="utf-8"><title>Devot: notes</title>
      <meta name="description" content="Notes &amp; more">
      <meta property="og:type" content="website">
      <meta property="og:locale" content="en_US">
      <meta name="twitter:title" content="Devot">
      <script type="module">const label = 'code'</script>
      <style>.a { color: red }</style>
      </head><body>
      <!-- note -->
      <a href="/" aria-label="Home"><img src="/a.svg" alt=""><span>Devot</span></a>
      <p>
        Hello&nbsp;there
      </p>
      <p>&copy; 2026 Devot</p>
      </body></html>`
    expect(pageCopy(html).toSorted()).toEqual(
      [
        'Devot: notes',
        'Notes & more',
        'Devot',
        'Home',
        'Devot',
        'Hello\u00a0there',
        '© 2026 Devot',
      ].toSorted(),
    )
  })

  it('flattens a catalog, calling its functions with the given arguments', () => {
    const catalog = { a: 'One', b: { c: ' Two ', d: (n: number) => `Year ${n}` }, e: ['Three'] }
    expect([...catalogStrings(catalog, [2026])].toSorted()).toEqual(
      ['One', 'Three', 'Two', 'Year 2026'].toSorted(),
    )
  })
})
