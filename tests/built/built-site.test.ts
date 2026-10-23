import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SITE_URL } from '../../src/site.ts'
import { allows, directives, siteCsp } from '../support/headers.ts'
import { scripts, tags } from '../support/html.ts'
import { filesUnder, readRepoFile, REPO } from '../support/source-files.ts'

// The output of `pnpm build`, checked against the policy Cloudflare will serve with it.

const csp = directives(siteCsp(readRepoFile('dist/_headers')))
const pages = filesUnder('dist').filter((file) => file.endsWith('.html'))
const pageUrl = (page: string) =>
  new URL(page.replace(/^dist\//, '').replace(/index\.html$/, ''), SITE_URL).href

/** What the browser fetches for a tag, and the CSP directive that governs it. */
function fetches(html: string): { directive: string; url: string }[] {
  return tags(html).flatMap(({ name, attrs }) => {
    const rel = (attrs.get('rel') ?? '').split(/\s+/)
    const srcset = (attrs.get('srcset') ?? '')
      .split(',')
      .map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
      .filter(Boolean)
    if (name === 'script' && attrs.has('src'))
      return [{ directive: 'script-src', url: attrs.get('src') as string }]
    if (name === 'link' && rel.includes('stylesheet'))
      return [{ directive: 'style-src', url: attrs.get('href') ?? '' }]
    if (name === 'link' && rel.some((r) => /icon/.test(r)))
      return [{ directive: 'img-src', url: attrs.get('href') ?? '' }]
    if (name === 'link' && rel.includes('manifest'))
      return [{ directive: 'manifest-src', url: attrs.get('href') ?? '' }]
    if (name === 'link' && (rel.includes('preload') || rel.includes('modulepreload'))) {
      const directive =
        attrs.get('as') === 'style'
          ? 'style-src'
          : attrs.get('as') === 'font'
            ? 'font-src'
            : 'script-src'
      return [{ directive, url: attrs.get('href') ?? '' }]
    }
    if (name === 'img' || name === 'source') {
      const src = attrs.get('src')
      return [...(src ? [src] : []), ...srcset].map((url) => ({ directive: 'img-src', url }))
    }
    if (name === 'video' || name === 'audio')
      return attrs.has('src') ? [{ directive: 'media-src', url: attrs.get('src') as string }] : []
    if (name === 'iframe') return [{ directive: 'frame-src', url: attrs.get('src') ?? '' }]
    return []
  })
}

it('builds the home page', () => {
  expect(pages).toContain('dist/index.html')
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
      return !allows(sources, url, pageUrl(page))
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

  it('is English, with a title, a description and a canonical URL on devot.online', () => {
    const meta = (key: string) =>
      tags(html, 'meta')
        .find(({ attrs }) => attrs.get('name') === key || attrs.get('property') === key)
        ?.attrs.get('content')
    expect(tags(html, 'html')[0]?.attrs.get('lang')).toBe('en')
    expect(html).toMatch(/<title>[^<]+<\/title>/)
    expect(meta('description')).toBeTruthy()
    const canonical = tags(html, 'link').find(({ attrs }) => attrs.get('rel') === 'canonical')
    expect(canonical?.attrs.get('href')).toBe(pageUrl(page))
    expect(meta('og:url')).toBe(pageUrl(page))
    expect(meta('og:title')).toBeTruthy()
    expect(meta('twitter:card')).toBe('summary')
    expect(
      tags(html, 'meta').filter(({ attrs }) => attrs.get('name') === 'theme-color'),
    ).toHaveLength(2)
    expect(tags(html, 'h1')).toHaveLength(1)
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
    expect(listed.toSorted()).toEqual(pages.map(pageUrl).toSorted())
  })
})
