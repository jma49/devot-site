import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { ComparePage } from '../../src/i18n/en/compare.ts'
import type { DocRun } from '../../src/i18n/en/docs.ts'
import { COMPARE_PATH, comparePath, FOOTER_GROUPS } from '../../src/lib/links.ts'
import { llmsTxt } from '../../src/lib/llms-txt.ts'
import { comparison } from '../../src/lib/structured-data.ts'
import { LICENCE_PRICE, SITE_URL } from '../../src/site.ts'

const { pages } = en.compare
const blocksOf = (page: ComparePage) => page.sections.flatMap((section) => section.blocks)
const runsOf = (page: ComparePage): DocRun[] =>
  blocksOf(page).flatMap((block) =>
    block.kind === 'text'
      ? block.runs
      : block.kind === 'list'
        ? block.items.flat()
        : block.kind === 'table'
          ? block.rows.flat(2)
          : [],
  )
const hrefsOf = (page: ComparePage) =>
  runsOf(page).flatMap((run) => (typeof run === 'object' && 'href' in run ? [run.href] : []))

it('links the comparisons from the footer', () => {
  const resources = FOOTER_GROUPS.find((group) => group.id === 'resources')
  expect(resources?.links).toContainEqual({ id: 'compare', href: COMPARE_PATH })
})

describe.each(pages)('$slug', (page) => {
  it('has a slug, a title and a description sized for search results', () => {
    expect(page.slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(page.title).toMatch(new RegExp(`^Devot vs ${page.other}: .+ · Devot$`))
    expect(page.title.length).toBeLessThanOrEqual(70)
    expect(page.description.length).toBeGreaterThanOrEqual(70)
    expect(page.description.length).toBeLessThanOrEqual(160)
  })

  it('dates its facts, and shows the date it states', () => {
    expect(page.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const day = new Date(`${page.checked}T00:00:00Z`)
    const label = day.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    expect(page.checkedLabel).toBe(`Facts checked ${label}`)
  })

  it('compares in a table whose every row has a cell for Devot and for the other app', () => {
    const tables = blocksOf(page).filter((block) => block.kind === 'table')
    expect(tables).toHaveLength(1)
    const [glance] = tables
    if (glance?.kind !== 'table') throw new Error('no table')
    expect(glance.head).toEqual(['', 'Devot', page.other])
    for (const row of glance.rows) expect(row).toHaveLength(3)
    expect(glance.rows.flat(2).join(' ')).toContain(LICENCE_PRICE)
  })

  it('says when the other app fits better, not only when Devot does', () => {
    expect(page.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(['glance', 'devot', 'other', 'sources']),
    )
  })

  it("lists its sources over https, each one in the page's links", () => {
    expect(page.sources.length).toBeGreaterThan(0)
    for (const source of page.sources) {
      expect(new URL(source.href).protocol).toBe('https:')
      expect(hrefsOf(page)).toContain(source.href)
    }
  })

  it('is an Article about Devot under the comparisons, and listed in llms.txt', () => {
    const url = new URL(comparePath(page.slug), SITE_URL).href
    const [article, trail] = comparison(en, page)['@graph']
    expect(article).toMatchObject({ '@type': 'Article', url, dateModified: page.checked })
    expect(trail.itemListElement.at(-1)?.item).toBe(url)
    expect(llmsTxt(en)).toContain(url)
  })
})
