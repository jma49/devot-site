import type { Messages } from '../i18n/en.ts'
import { BLOG_PATH, blogPath, FEED_PATH } from './links.ts'
import { SITE_URL } from '../site.ts'

const escapeXml = (text: string) =>
  text.replace(
    /[<>&'"]/g,
    (char) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[char]};`,
  )

/** An ISO date as RSS writes it, at midnight UTC. */
export const rfc822 = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).toUTCString()

/** The blog as an RSS 2.0 feed, newest post first. */
export function blogFeed(t: Messages): string {
  const { index, posts } = t.blog
  const newestFirst = posts.toSorted((a, b) => b.published.localeCompare(a.published))
  const absolute = (path: string) => new URL(path, SITE_URL).href
  const items = newestFirst.map((post) => {
    const url = absolute(blogPath(post.slug))
    return [
      '    <item>',
      `      <title>${escapeXml(post.heading)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${rfc822(post.published)}</pubDate>`,
      `      <description>${escapeXml(post.description)}</description>`,
      '    </item>',
    ].join('\n')
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(t.blog.feedTitle)}</title>`,
    `    <link>${absolute(BLOG_PATH)}</link>`,
    `    <description>${escapeXml(index.description)}</description>`,
    '    <language>en</language>',
    `    <atom:link href="${absolute(FEED_PATH)}" rel="self" type="application/rss+xml"/>`,
    ...(newestFirst[0]
      ? [`    <lastBuildDate>${rfc822(newestFirst[0].published)}</lastBuildDate>`]
      : []),
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}
