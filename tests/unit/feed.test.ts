import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { blogFeed, rfc822 } from '../../src/lib/feed.ts'
import { blogPath } from '../../src/lib/links.ts'
import { SITE_URL } from '../../src/site.ts'

const feed = blogFeed(en)
const links = [...feed.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1])

it('lists every post once, newest first', () => {
  const expected = en.blog.posts
    .toSorted((a, b) => b.published.localeCompare(a.published))
    .map((post) => new URL(blogPath(post.slug), SITE_URL).href)
  expect(links).toEqual(expected)
})

it('names its own address and the blog it comes from', () => {
  expect(feed).toContain(`<atom:link href="${SITE_URL}blog/rss.xml" rel="self"`)
  expect(feed).toContain(`<link>${SITE_URL}blog</link>`)
})

it('escapes text that would break the XML', () => {
  const t = {
    ...en,
    blog: {
      ...en.blog,
      posts: [{ ...en.blog.posts[0]!, heading: 'Tags <b> & "quotes"' }],
    },
  }
  expect(blogFeed(t)).toContain('<title>Tags &lt;b&gt; &amp; &quot;quotes&quot;</title>')
})

it('writes dates as RSS does', () => {
  expect(rfc822('2026-11-11')).toBe('Wed, 11 Nov 2026 00:00:00 GMT')
})
