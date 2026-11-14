import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { DocPage, DocRun } from '../../src/i18n/en/docs.ts'
import { DOCS_PATH, docPath, FOOTER_GROUPS } from '../../src/lib/links.ts'
import { REPO_URL, SITE_URL } from '../../src/site.ts'

const { pages } = en.docs
const runsOf = (page: DocPage): DocRun[] =>
  page.sections.flatMap((section) =>
    section.blocks.flatMap((block) =>
      block.kind === 'text' ? block.runs : block.kind === 'list' ? block.items.flat() : [],
    ),
  )
const hrefsOf = (page: DocPage) =>
  runsOf(page).flatMap((run) => (typeof run === 'object' && 'href' in run ? [run.href] : []))

it('gives every page its own slug, a lower-case word or words joined by hyphens', () => {
  const slugs = pages.map((page) => page.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
  for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
  expect(docPath('sync')).toBe('/docs/sync')
})

it('links the docs from the footer', () => {
  const resources = FOOTER_GROUPS.find((group) => group.id === 'resources')
  expect(resources?.links).toContainEqual({ id: 'docs', href: DOCS_PATH })
})

describe.each(pages)('$slug', (page) => {
  it('has a title and a description sized for search results', () => {
    expect(page.title).toMatch(/^Devot: /)
    expect(page.title.length).toBeLessThanOrEqual(70)
    expect(page.description.length).toBeGreaterThanOrEqual(70)
    expect(page.description.length).toBeLessThanOrEqual(160)
    expect(page.summary.length).toBeGreaterThan(20)
  })

  it('names each section with its own anchor', () => {
    const ids = page.sections.map((section) => section.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('links only to this site, its plugin archives, the Devot repository or its releases, over https', () => {
    const allowed = (href: string) =>
      href.startsWith('/')
        ? /^\/[a-z-]+(\/[a-z-]+)?$/.test(href) || /^\/plugins\/[a-z0-9-]+\.zip$/.test(href)
        : new URL(href).protocol === 'https:' &&
          (href.startsWith(REPO_URL) || href.startsWith(SITE_URL))
    expect(hrefsOf(page).filter((href) => !allowed(href))).toEqual([])
  })

  it('labels every code block for assistive technology', () => {
    const labels = page.sections
      .flatMap((section) => section.blocks)
      .flatMap((block) => (block.kind === 'code' ? [block.label] : []))
    expect(labels.filter((label) => label.length <= 5)).toEqual([])
  })
})

it('links within the docs only to pages that exist', () => {
  const slugs = new Set(pages.map((page) => page.slug))
  const internal = pages
    .flatMap(hrefsOf)
    .filter((href) => href.startsWith(`${DOCS_PATH}/`))
    .map((href) => href.slice(DOCS_PATH.length + 1))
  expect(internal.filter((slug) => !slugs.has(slug))).toEqual([])
})
