import type { APIRoute } from 'astro'
import smallCut from '../assets/app-icon-small.svg?raw'
import { tileSvg } from '../lib/icons.ts'

export const GET: APIRoute = () =>
  new Response(tileSvg(smallCut), { headers: { 'content-type': 'image/svg+xml' } })
