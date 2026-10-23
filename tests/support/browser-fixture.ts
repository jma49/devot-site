import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { extname, join } from 'node:path'
import type { Page } from '@playwright/test'
import { siteCsp } from './headers.ts'
import { readRepoFile, REPO } from './source-files.ts'

// A page that runs this repo's own modules in a real browser, under the site's policy, without a
// page of the site in between. `/__src/…` serves a file of src/ (TypeScript with its types
// removed), `/__pkg/…` a file of node_modules, so a fixture imports `/__src/lib/motion.ts`.

const TYPES: Record<string, string> = {
  '.ts': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
}

const csp = siteCsp(readRepoFile('dist/_headers'))

export interface Fixture {
  /** The body of the page. */
  body: string
  /** The page's stylesheet: inline styles are blocked, so sizes come from here. */
  css?: string
  /** A module that runs on the page, importing from `/__src/…`. */
  script?: string
}

export function packageUrl(specifier: string): string {
  return specifier === 'gsap' ? '/__pkg/gsap/index.js' : `/__pkg/${specifier}.js`
}

function moduleSource(file: string): string {
  const text = readFileSync(file, 'utf8')
  if (!file.endsWith('.ts')) return text
  return stripTypeScriptTypes(text).replace(
    /(\bfrom\s*)(['"])(gsap(?:\/\w+)?)\2/g,
    (_, from: string, quote: string, specifier: string) =>
      `${from}${quote}${packageUrl(specifier)}${quote}`,
  )
}

export async function openFixture(page: Page, { body, css = '', script = '' }: Fixture) {
  const serve = (pattern: string, root: string, prefix: string) =>
    page.route(pattern, (route) => {
      const path = new URL(route.request().url()).pathname.slice(prefix.length)
      route.fulfill({
        contentType: TYPES[extname(path)] ?? 'application/octet-stream',
        body: moduleSource(join(root, path)),
      })
    })
  await serve('**/__src/**', join(REPO, 'src'), '/__src/')
  await serve('**/__pkg/**', join(REPO, 'node_modules'), '/__pkg/')
  await page.route('**/__fixture/page.css', (route) =>
    route.fulfill({ contentType: 'text/css', body: css }),
  )
  await page.route('**/__fixture/page.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: script }),
  )
  await page.route('**/__fixture/page.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': csp },
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title>
<link rel="stylesheet" href="/__src/theme/tokens.css">
<link rel="stylesheet" href="/__src/styles/motion.css">
<link rel="stylesheet" href="/__fixture/page.css">
<script type="module" src="/__fixture/page.js"></script>
</head><body><main><h1>Fixture</h1>${body}</main></body></html>`,
    }),
  )
  await page.goto('/__fixture/page.html')
}
