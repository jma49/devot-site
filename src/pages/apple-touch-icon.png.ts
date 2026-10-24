import type { APIRoute } from 'astro'
import fullBleed from '../assets/app-icon-ios.svg?raw'
import { iconPng } from '../lib/icons.ts'

// iOS rounds the corners itself and fills transparency with black, so it gets the opaque square.
export const GET: APIRoute = async () =>
  new Response(await iconPng(fullBleed, { size: 180 }), {
    headers: { 'content-type': 'image/png' },
  })
