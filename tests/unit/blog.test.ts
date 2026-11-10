import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import type { BlogPost } from '../../src/i18n/en/blog.ts'
import { llmsTxt } from '../../src/lib/llms-txt.ts'
import { BLOG_PATH, blogPath, FOOTER_GROUPS } from '../../src/lib/links.ts'
import { blogPosting } from '../../src/lib/structured-data.ts'
import { REPO_URL, SITE_URL } from '../../src/site.ts'

const { posts } = en.blog
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const hrefsOf = (post: BlogPost) =>
  post.sections
    .flatMap((section) => section.blocks)
    .flatMap((block) =>
      block.kind === 'text' ? block.runs : block.kind === 'list' ? block.items.flat() : [],
    )
    .flatMap((run) => (typeof run === 'object' && 'href' in run ? [run.href] : []))

it('gives every post its own slug and links the blog from the footer', () => {
  const slugs = posts.map((post) => post.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
  for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  const resources = FOOTER_GROUPS.find((group) => group.id === 'resources')
  expect(resources?.links).toContainEqual({ id: 'blog', href: BLOG_PATH })
})

it('lists the newest post first', () => {
  const dates = posts.map((post) => post.published)
  expect(dates).toEqual(dates.toSorted().toReversed())
})

describe.each(posts)('$slug', (post) => {
  it('has a title and a description sized for search results', () => {
    expect(post.title.length).toBeLessThanOrEqual(70)
    expect(post.title).toMatch(/ · Devot$/)
    expect(post.description.length).toBeGreaterThanOrEqual(70)
    expect(post.description.length).toBeLessThanOrEqual(160)
  })

  it('shows the date it went up, as its ISO date says', () => {
    const [year, month, day] = post.published.split('-').map(Number)
    expect(post.publishedLabel).toBe(`Published ${day} ${MONTHS.at(month! - 1)} ${year}`)
  })

  it('links only to this site or the Devot repository', () => {
    const allowed = (href: string) =>
      href.startsWith('/') || href.startsWith(REPO_URL) || href.startsWith(SITE_URL)
    expect(hrefsOf(post).filter((href) => !allowed(href))).toEqual([])
  })

  it('is described as a BlogPosting at its own address', () => {
    expect(blogPosting(en, post)).toMatchObject({
      '@type': 'BlogPosting',
      headline: post.heading,
      datePublished: post.published,
      url: new URL(blogPath(post.slug), SITE_URL).href,
    })
  })

  it('is listed in llms.txt', () => {
    expect(llmsTxt(en)).toContain(new URL(blogPath(post.slug), SITE_URL).href)
  })
})
