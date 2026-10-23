import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { SITE_URL } from '../../src/site.ts'
import { catalogStrings, pageCopy } from '../support/copy-policy.ts'
import { fetches } from '../support/csp-fetches.ts'
import { allows, directives, siteCsp } from '../support/headers.ts'
import { scripts, tags } from '../support/html.ts'
import { pngSize } from '../support/png.ts'
import { filesUnder, readRepoFile, REPO } from '../support/source-files.ts'

// The output of `pnpm build`, checked against the policy Cloudflare will serve with it.

const csp = directives(siteCsp(readRepoFile('dist/_headers')))
const pages = filesUnder('dist').filter((file) => file.endsWith('.html'))
const pageUrl = (page: string) =>
  new URL(page.replace(/^dist\//, '').replace(/index\.html$/, ''), SITE_URL).href
// Cloudflare serves it, with status 404, for any path that matches no file.
const NOT_FOUND = 'dist/404.html'
const indexed = pages.filter((page) => page !== NOT_FOUND)
const meta = (html: string, key: string) =>
  tags(html, 'meta')
    .find(({ attrs }) => attrs.get('name') === key || attrs.get('property') === key)
    ?.attrs.get('content')
const canonicalOf = (html: string) =>
  tags(html, 'link')
    .find(({ attrs }) => attrs.get('rel') === 'canonical')
    ?.attrs.get('href')

it('builds the home page and a 404 page', () => {
  expect(pages).toContain('dist/index.html')
  expect(pages).toContain(NOT_FOUND)
})

describe.each(pages)('%s', (page) => {
  const html = readRepoFile(page)

  it('has no inline <script> the CSP would block', () => {
    const inline = scripts(html).filter(
      ({ attrs }) =>
        !/\bsrc\s*=/.test(attrs) && !/\btype\s*=\s*["']?application\/ld\+json/.test(attrs),
    )
    expect(inline.map(({ body }) => body.slice(0, 80))).toEqual([])
  })

  it('has no inline styles, event handlers or javascript: URLs', () => {
    expect(html).not.toMatch(/<style\b/i)
    const offending = tags(html).flatMap(({ name, attrs }) =>
      [...attrs]
        .filter(
          ([attr, value]) =>
            attr === 'style' || attr.startsWith('on') || /^\s*javascript:/i.test(value),
        )
        .map(([attr]) => `<${name} ${attr}>`),
    )
    expect(offending).toEqual([])
  })

  it('loads every script, stylesheet and image from a source the CSP allows', () => {
    const loads = fetches(html)
    expect(loads.length).toBeGreaterThan(0)
    const blocked = loads.filter(({ directive, url }) => {
      const sources = csp.get(directive) ?? csp.get('default-src') ?? []
      return directive === 'unknown' || !allows(sources, url, pageUrl(page))
    })
    expect(blocked).toEqual([])
  })

  it('points at files that exist in the build', () => {
    const missing = fetches(html)
      .map(({ url }) => new URL(url, pageUrl(page)))
      .filter((url) => url.origin === new URL(SITE_URL).origin)
      .filter(({ pathname }) => !existsSync(join(REPO, 'dist', decodeURIComponent(pathname))))
      .map(({ pathname }) => pathname)
    expect(missing).toEqual([])
  })

  it('is English, with a title, a description, one heading and link previews', () => {
    expect(tags(html, 'html')[0]?.attrs.get('lang')).toBe('en')
    expect(html).toMatch(/<title>[^<]+<\/title>/)
    expect(meta(html, 'description')).toBeTruthy()
    expect(meta(html, 'og:title')).toBeTruthy()
    expect(meta(html, 'twitter:card')).toBe('summary')
    expect(
      tags(html, 'meta').filter(({ attrs }) => attrs.get('name') === 'theme-color'),
    ).toHaveLength(2)
    expect(tags(html, 'h1')).toHaveLength(1)
  })

  it('takes all its text from src/i18n/en.ts', () => {
    const catalog = catalogStrings(en, [new Date().getFullYear()])
    expect(pageCopy(html).filter((text) => !catalog.has(text))).toEqual([])
  })

  it('links the square icons at stable, unhashed paths', () => {
    const icons = tags(html, 'link')
      .filter(({ attrs }) => /icon/.test(attrs.get('rel') ?? ''))
      .map(({ attrs }) => `${attrs.get('rel')} ${attrs.get('href')}`)
    expect(icons).toEqual([
      'icon /favicon.svg',
      'icon /favicon-192.png',
      'apple-touch-icon /apple-touch-icon.png',
    ])
  })
})

describe.each(indexed)('%s, a page for search engines', (page) => {
  const html = readRepoFile(page)

  it('names its canonical URL on devot.online', () => {
    expect(canonicalOf(html)).toBe(pageUrl(page))
    expect(meta(html, 'og:url')).toBe(pageUrl(page))
    expect(meta(html, 'robots')).toBeUndefined()
  })
})

describe('the 404 page', () => {
  const html = pages.includes(NOT_FOUND) ? readRepoFile(NOT_FOUND) : ''

  it('asks not to be indexed and claims no URL of its own', () => {
    expect(meta(html, 'robots')).toBe('noindex')
    expect(canonicalOf(html)).toBeUndefined()
    expect(meta(html, 'og:url')).toBeUndefined()
  })

  it('loads its files from the site root, so it works at any depth', () => {
    const relative = fetches(html)
      .map(({ url }) => url)
      .filter((url) => !/^(\/|https:\/\/)/.test(url))
    expect(relative).toEqual([])
  })
})

describe('icons', () => {
  it('serves the dove as a square SVG', () => {
    const svg = readRepoFile('dist/favicon.svg')
    const [, , width, height] = (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? '').split(/\s+/)
    expect(width).toBeTruthy()
    expect(width).toBe(height)
  })

  it('serves square PNGs for browsers and home screens that want one', () => {
    const size = (file: string) => pngSize(readFileSync(join(REPO, 'dist', file)))
    expect(size('favicon-192.png')).toEqual({ width: 192, height: 192 })
    expect(size('apple-touch-icon.png')).toEqual({ width: 180, height: 180 })
  })
})

describe('built CSS', () => {
  const sheets = filesUnder('dist/_astro').filter((file) => file.endsWith('.css'))

  it('pulls nothing from other origins or data: URLs', () => {
    expect(sheets.length).toBeGreaterThan(0)
    const urls = sheets.flatMap((sheet) =>
      [...readRepoFile(sheet).matchAll(/url\(\s*['"]?([^'")]+)|@import\s+['"]([^'"]+)/g)].map(
        (m) => `${sheet}: ${m[1] ?? m[2]}`,
      ),
    )
    expect(urls.filter((entry) => /: (data:|https?:|\/\/)/.test(entry))).toEqual([])
  })
})

describe('files for Cloudflare and crawlers', () => {
  it('ships public/_headers unchanged', () => {
    expect(readRepoFile('dist/_headers')).toBe(readRepoFile('public/_headers'))
  })

  it('lists every page in the sitemap that robots.txt names', () => {
    const robots = readRepoFile('dist/robots.txt')
    const sitemap = /^Sitemap: (\S+)$/m.exec(robots)?.[1] ?? ''
    expect(sitemap).toBe(new URL('sitemap-index.xml', SITE_URL).href)
    const index = readRepoFile('dist/sitemap-index.xml')
    const parts = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1] as string)
    expect(parts.length).toBeGreaterThan(0)
    const listed = parts.flatMap((part) =>
      [...readRepoFile(`dist${new URL(part).pathname}`).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (m) => m[1],
      ),
    )
    expect(listed.toSorted()).toEqual(indexed.map(pageUrl).toSorted())
  })
})
