import type { APIRoute } from 'astro'
import dove from '../assets/dove.svg?raw'
import { iconPng, squareSvg } from '../lib/icons.ts'
import { themeColors } from '../lib/theme-color.ts'
import tokensCss from '../theme/tokens.css?raw'

// iOS fills a transparent home-screen icon with black, so the dove sits on the light page surface.
export const GET: APIRoute = async () =>
  new Response(
    await iconPng(squareSvg(dove), {
      size: 180,
      inset: 22,
      background: themeColors(tokensCss).light,
    }),
    { headers: { 'content-type': 'image/png' } },
  )
