import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { tags } from '../support/html.ts'
import { filesUnder, readRepoFile } from '../support/source-files.ts'

// What the home page costs in script, gzipped as Cloudflare serves it. A first load runs the page's
// module scripts and everything they import statically; dynamic imports load later.

const KB = 1024
const HERO_FIRST_LOAD = 25 * KB
const ALL_SCRIPTS = 35 * KB

const html = readRepoFile('dist/index.html')
const chunks = filesUnder('dist/_astro').filter((file) => file.endsWith('.js'))
const gzipped = (file: string) => gzipSync(readRepoFile(file), { level: 9 }).length
const fileOf = (url: string) => `dist${new URL(url, 'https://devot.online/').pathname}`
const entries = tags(html, 'script')
  .map(({ attrs }) => attrs.get('src'))
  .filter((src): src is string => src !== undefined)
  .map(fileOf)

// The minifier quotes with any of the three quote marks.
const STATIC_IMPORT = /\bimport\s*(?:[\w$*{}\s,]+from\s*)?["'`]\.\/([^"'`]+\.js)["'`]/g
const DYNAMIC_IMPORT = /\bimport\(\s*["'`]\.\/([^"'`]+\.js)["'`]\s*\)/g
const WEBGL = /getContext\(\s*["'`]webgl["'`]/
const imports = (file: string, pattern: RegExp) =>
  [...readRepoFile(file).matchAll(pattern)].map((match) => `dist/_astro/${match[1]}`)

/** The file and everything it imports statically, once each. */
function firstLoad(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen
  seen.add(file)
  for (const dependency of imports(file, STATIC_IMPORT)) firstLoad(dependency, seen)
  return seen
}

const total = (files: Iterable<string>) => [...files].reduce((sum, file) => sum + gzipped(file), 0)
const heroEntry = entries.find((file) => /\/Hero\.astro_/.test(file))

describe('the home page script weight', () => {
  it('finds the hero entry among the module scripts', () => {
    expect(heroEntry).toBeDefined()
  })

  it(`keeps the hero's first load within ${HERO_FIRST_LOAD / KB} KB gzipped`, () => {
    expect(total(firstLoad(heroEntry ?? ''))).toBeLessThanOrEqual(HERO_FIRST_LOAD)
  })

  it(`keeps every script the site ships within ${ALL_SCRIPTS / KB} KB gzipped`, () => {
    expect(chunks.length).toBeGreaterThan(0)
    expect(total(chunks)).toBeLessThanOrEqual(ALL_SCRIPTS)
  })

  it('loads the WebGL backdrop as a chunk of its own, only when the hero asks for it', () => {
    const webgl = chunks.filter((file) => WEBGL.test(readRepoFile(file)))
    expect(webgl).toHaveLength(1)
    const [backdrop = ''] = webgl
    const firstLoaded = new Set(entries.flatMap((entry) => [...firstLoad(entry)]))
    expect(firstLoaded).not.toContain(backdrop)
    expect(imports(heroEntry ?? '', DYNAMIC_IMPORT)).toContain(backdrop)
  })

  it('imports the backdrop without preloading what the page has already loaded', () => {
    // Vite's preload helper adds a preload link for each of the chunk's dependencies, all of
    // which the hero has loaded already; WebKit warns about every such link as unused.
    for (const chunk of chunks) expect(readRepoFile(chunk), chunk).not.toMatch(/__vite__mapDeps/)
  })
})
