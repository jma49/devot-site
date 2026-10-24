import { describe, expect, it } from 'vitest'
import { allows, directives, parseHeaders, siteCsp } from '../support/headers.ts'
import { readRepoFile } from '../support/source-files.ts'

// Cloudflare Pages applies public/_headers; `astro preview` ignores it, so the e2e tests add the CSP.
const text = readRepoFile('public/_headers')
const rules = parseHeaders(text)
const headersFor = (pattern: string) =>
  new Map(
    rules.find((rule) => rule.pattern === pattern)?.headers.map(([n, v]) => [n.toLowerCase(), v]),
  )

describe('public/_headers', () => {
  const site = headersFor('/*')
  const csp = directives(siteCsp(text))

  it('stays within Cloudflare limits: 100 rules, 2,000 characters a line', () => {
    expect(rules.length).toBeLessThanOrEqual(100)
    expect(text.split('\n').filter((line) => line.length > 2000)).toEqual([])
  })

  it('sets the policy once, for every path, so no two policies combine', () => {
    const withCsp = rules.filter(({ headers }) =>
      headers.some(([name]) => name.toLowerCase() === 'content-security-policy'),
    )
    expect(withCsp.map(({ pattern }) => pattern)).toEqual(['/*'])
  })

  it('denies everything by default and allows only this site plus Cloudflare Web Analytics', () => {
    expect(csp.get('default-src')).toEqual(["'none'"])
    expect(csp.get('script-src')).toEqual(["'self'", 'https://static.cloudflareinsights.com'])
    expect(csp.get('connect-src')).toEqual(["'self'", 'https://cloudflareinsights.com'])
    expect(csp.get('style-src')).toEqual(["'self'"])
    expect(csp.get('img-src')).toEqual(["'self'"])
    expect(csp.get('media-src')).toEqual(["'self'"])
    for (const directive of ['frame-ancestors', 'base-uri', 'form-action', 'object-src']) {
      expect(csp.get(directive), directive).toEqual(["'none'"])
    }
  })

  it('never allows inline code, eval or data: URLs', () => {
    const sources = [...csp.values()].flat()
    for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", 'data:', '*']) {
      expect(sources, unsafe).not.toContain(unsafe)
    }
  })

  it("allows the analytics beacon's host, not one path, as its injected URL is versioned", () => {
    const analytics = csp.get('script-src')?.filter((s) => s.includes('cloudflareinsights')) ?? []
    expect(analytics.map((source) => new URL(source).pathname)).toEqual(['/'])
  })

  it('sends the transport and browser security headers', () => {
    expect(site.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains')
    expect(site.get('x-content-type-options')).toBe('nosniff')
    expect(site.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(site.get('x-frame-options')).toBe('DENY')
    expect(site.get('cross-origin-opener-policy')).toBe('same-origin')
    const permissions = site.get('permissions-policy') ?? ''
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(permissions, feature).toContain(`${feature}=()`)
    }
  })

  it("drops Cloudflare's default open CORS header", () => {
    expect(rules.find((rule) => rule.pattern === '/*')?.detach).toEqual([
      'Access-Control-Allow-Origin',
    ])
  })

  it('caches hashed build assets for a year and nothing else', () => {
    expect(headersFor('/_astro/*').get('cache-control')).toBe('public, max-age=31536000, immutable')
    const immutable = rules.filter(({ headers }) =>
      headers.some(([, v]) => v.includes('immutable')),
    )
    expect(immutable.map(({ pattern }) => pattern)).toEqual(['/_astro/*'])
  })

  // Fonts and clips keep fixed names, so a re-cut file must reach a returning visitor within a week.
  it.each(['/fonts/*', '/media/*'])('caches %s for a week without pinning it', (pattern) => {
    expect(headersFor(pattern).get('cache-control')).toBe('public, max-age=604800')
  })
})

describe('parseHeaders', () => {
  it('reads patterns, headers, removals and comments', () => {
    const parsed = parseHeaders('# note\n/*\n  A: 1; b=2\n  ! B\n\n/x/*\n  C: three: 3\n')
    expect(parsed).toEqual([
      { pattern: '/*', headers: [['A', '1; b=2']], detach: ['B'] },
      { pattern: '/x/*', headers: [['C', 'three: 3']], detach: [] },
    ])
  })

  it('refuses a header line before any pattern', () => {
    expect(() => parseHeaders('  A: 1\n')).toThrow(/^E_HEADERS_SYNTAX/)
  })
})

describe('allows', () => {
  const page = 'https://devot.online/'

  it("lets 'self' load this site's paths only", () => {
    expect(allows(["'self'"], '/_astro/a.css', page)).toBe(true)
    expect(allows(["'self'"], 'https://devot.online/x', page)).toBe(true)
    expect(allows(["'self'"], '//evil.example/a.js', page)).toBe(false)
    expect(allows(["'self'"], 'data:text/css,a', page)).toBe(false)
  })

  it('matches a host source by host, and a path source by path or prefix', () => {
    const host = ['https://static.cloudflareinsights.com']
    expect(allows(host, 'https://static.cloudflareinsights.com/beacon.min.js/v8c78', page)).toBe(
      true,
    )
    expect(allows(host, 'http://static.cloudflareinsights.com/beacon.min.js', page)).toBe(false)
    expect(allows(host, 'https://cloudflareinsights.com/', page)).toBe(false)
    const file = ['https://static.cloudflareinsights.com/beacon.min.js']
    expect(allows(file, 'https://static.cloudflareinsights.com/beacon.min.js/v8c78', page)).toBe(
      false,
    )
  })
})
