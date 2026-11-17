import type { APIRoute } from 'astro'
import { messages } from '../../i18n/index.ts'
import { blogFeed } from '../../lib/feed.ts'

export const GET: APIRoute = () =>
  new Response(blogFeed(messages()), {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  })
