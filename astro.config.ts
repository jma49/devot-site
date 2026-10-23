import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'
import { SITE_URL } from './src/site.ts'

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  // public/_headers allows no inline script or style, so every stylesheet, script and image
  // must be a file under /_astro/, never inlined into the page or turned into a data: URL.
  build: { inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
})
