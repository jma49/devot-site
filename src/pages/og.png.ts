import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { APIRoute } from 'astro'
import dove from '../assets/dove.svg?raw'
import { ogImage } from '../lib/og-image.ts'
import { media } from '../media.ts'
import tokensCss from '../theme/tokens.css?raw'

// The build runs from the project root, where public/ holds the recorded media.
export const GET: APIRoute = async () =>
  new Response(
    await ogImage({
      poster: readFileSync(join(process.cwd(), 'public', media.hero.poster)),
      dove,
      tokensCss,
    }),
    { headers: { 'content-type': 'image/png' } },
  )
