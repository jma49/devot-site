import type { Messages } from '../i18n/en.ts'
import { blogPath } from './links.ts'
import { SITE_URL } from '../site.ts'

interface SitemapItem {
  url: string
  lastmod?: string
}

/** Dates each blog post's sitemap entry by the day it went up; other pages carry no date they could not keep. */
export function datedSitemapItem<T extends SitemapItem>(t: Messages, item: T): T {
  const post = t.blog.posts.find(({ slug }) => new URL(blogPath(slug), SITE_URL).href === item.url)
  return post ? { ...item, lastmod: post.published } : item
}
