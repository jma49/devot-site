import { expect, it } from 'vitest'
import { en } from '../../src/i18n/en.ts'
import { SITEMAP_I18N } from '../../src/i18n/index.ts'
import { blogPath } from '../../src/lib/links.ts'
import { datedSitemapItem } from '../../src/lib/sitemap.ts'
import { SITE_URL } from '../../src/site.ts'

it('dates each blog post by the day it went up', () => {
  for (const post of en.blog.posts) {
    const url = new URL(blogPath(post.slug), SITE_URL).href
    expect(datedSitemapItem(en, { url })).toEqual({ url, lastmod: post.published })
  }
})

it('leaves other pages undated', () => {
  expect(datedSitemapItem(en, { url: SITE_URL })).toEqual({ url: SITE_URL })
})

it('maps the Chinese path prefix to its language, English to the root', () => {
  expect(SITEMAP_I18N).toEqual({ defaultLocale: 'en', locales: { en: 'en', zh: 'zh-Hans' } })
})
