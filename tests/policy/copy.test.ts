import { expect, it } from 'vitest'
import { inlineCopy } from '../support/copy-policy.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// User-facing text lives in src/i18n so another language is one more catalog.

it('templates take their text from src/i18n', () => {
  const templates = filesUnder('src').filter((file) => file.endsWith('.astro'))
  const offenders = templates.flatMap((file) =>
    inlineCopy(readRepoFile(file)).map((text) => `${file}: ${text}`),
  )
  expect(templates.length).toBeGreaterThan(0)
  expect(offenders).toEqual([])
})

it('the scan finds literal text and labels, and leaves expressions, code and markup alone', () => {
  const sample = `---
const title = 'Not markup'
---
<header class="site">
  <a href="/" aria-label="Home">{t.siteName}</a>
  <img src={dove.src} alt="" width="28" />
  <img src={dove.src} alt={t.logo} />
  <p>Hello there</p>
  <p>{t.lead}&nbsp;{' '}</p>
  <meta property="og:type" content="website" />
  {items.map((item) => <li>{item.label}</li>)}
</header>
<!-- a comment -->
<script>const x = 'code'</script>
<style>.site { color: var(--a); }</style>
`
  expect(inlineCopy(sample)).toEqual(['aria-label="Home"', 'Hello there'])
})
