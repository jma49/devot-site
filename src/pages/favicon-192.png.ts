import type { APIRoute } from 'astro'
import dove from '../assets/dove.svg?raw'
import { iconPng, squareSvg } from '../lib/icons.ts'

export const GET: APIRoute = async () =>
  new Response(await iconPng(squareSvg(dove), { size: 192 }), {
    headers: { 'content-type': 'image/png' },
  })
