import type { APIRoute, GetStaticPaths } from 'astro'
import { messages } from '../../i18n/index.ts'
import { previewSlug, themeColors, themePreviewSvg } from '../../lib/theme-preview.ts'

export const getStaticPaths = (() =>
  messages().themes.gallery.map((theme) => ({
    params: { slug: previewSlug(theme) },
    props: { theme },
  }))) satisfies GetStaticPaths

export const GET: APIRoute = ({ props }) =>
  new Response(themePreviewSvg(themeColors(process.cwd(), props.theme)), {
    headers: { 'content-type': 'image/svg+xml' },
  })
