import type { APIRoute } from 'astro'
import { pluginIndex } from '../../lib/plugin-index.ts'

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await pluginIndex()), {
    headers: { 'content-type': 'application/json' },
  })
