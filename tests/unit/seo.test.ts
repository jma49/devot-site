import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { BlogPost } from '../../src/i18n/en/blog.ts'
import type { DocPage, DocRun } from '../../src/i18n/en/docs.ts'
import { zhHans } from '../../src/i18n/zh-Hans.ts'
import { COMPARE_PATH } from '../../src/lib/links.ts'

const runsOf = (sections: { blocks: DocPage['sections'][number]['blocks'] }[]): DocRun[] =>
  sections.flatMap((section) =>
    section.blocks.flatMap((block) =>
      block.kind === 'text' ? block.runs : block.kind === 'list' ? block.items.flat() : [],
    ),
  )
const hrefsOf = (sections: BlogPost['sections']) =>
  runsOf(sections).flatMap((run) => (typeof run === 'object' && 'href' in run ? [run.href] : []))

it('keeps the home title and description inside a search result, in both languages', () => {
  for (const description of [en.meta.description, zhHans.meta.description]) {
    expect(description.length).toBeGreaterThanOrEqual(70)
    expect(description.length).toBeLessThanOrEqual(160)
  }
  expect(en.meta.title.length).toBeLessThanOrEqual(60)
  expect(en.meta.description).toMatch(/\bnotes app\b/)
  expect(en.meta.description).toMatch(/encrypted sync/i)
  expect(en.meta.description).toMatch(/search by meaning/i)
  expect(zhHans.meta.description).toContain(zhHans.edge.items[0]!.title.slice(0, 7))
})

it('names a topic in the docs, blog and support titles', () => {
  expect(en.docs.index.title.length).toBeLessThanOrEqual(60)
  expect(en.blog.index.title.length).toBeLessThanOrEqual(60)
  expect(en.support.title.length).toBeLessThanOrEqual(60)
  expect(en.docs.index.title).toMatch(/sync/i)
  expect(en.blog.index.title).toMatch(/sync/i)
  expect(en.support.title).toMatch(/trial/i)
})

it('links the comparison pages from guide and post body copy', () => {
  const hrefs = [
    ...en.blog.posts.flatMap((post) => hrefsOf(post.sections)),
    ...en.docs.pages.flatMap((page) => hrefsOf(page.sections)),
  ]
  expect(hrefs.filter((href) => href === COMPARE_PATH).length).toBeGreaterThanOrEqual(3)
})
