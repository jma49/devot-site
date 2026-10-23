import type { APIRoute } from 'astro'
import dove from '../assets/dove.svg?raw'
import { squareSvg } from '../lib/icons.ts'

export const GET: APIRoute = () =>
  new Response(squareSvg(dove), { headers: { 'content-type': 'image/svg+xml' } })
