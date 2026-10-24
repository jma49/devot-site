import type { APIRoute } from 'astro'
import appIcon from '../assets/app-icon.svg?raw'
import { iconPng, tileSvg } from '../lib/icons.ts'

export const GET: APIRoute = async () =>
  new Response(await iconPng(tileSvg(appIcon), { size: 192 }), {
    headers: { 'content-type': 'image/png' },
  })
