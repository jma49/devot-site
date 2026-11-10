import type { APIRoute } from 'astro'
import { messages } from '../i18n/index.ts'
import { llmsTxt } from '../lib/llms-txt.ts'

export const GET: APIRoute = () =>
  new Response(llmsTxt(messages()), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
