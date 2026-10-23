import { expect, it } from 'vitest'
import { media } from '../../src/media.ts'
import { readRepoFile } from '../support/source-files.ts'

// The hero's poster comes from Clip.astro's stylesheet, one rule per variant with the last match
// winning; those paths must stay the ones src/media.ts names.

it('styles the hero poster for each variant, the most specific rule last', () => {
  const source = readRepoFile('src/components/Clip.astro')
  const style = source.slice(source.indexOf('<style>'))
  const urls = [...style.matchAll(/url\('([^']+)'\)/g)].map(([, url]) => url)
  const poster = (scheme: 'light' | 'dark', phone: boolean) =>
    media.hero.variants.find((variant) => variant.scheme === scheme && variant.phone === phone)
      ?.poster
  expect(urls).toEqual([
    poster('light', false),
    poster('dark', false),
    poster('light', true),
    poster('dark', true),
  ])
})
