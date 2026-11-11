import { expect, it } from 'vitest'
import { media, pinned } from '../../src/media.ts'
import { readRepoFile } from '../support/source-files.ts'

// The hero's poster comes from Clip.astro's stylesheet, one rule per variant with the last match
// winning; those paths must stay the ones src/media.ts names. The hero opens on its dark recording
// in either scheme, so the rules are for that appearance.

it('styles the hero poster for each variant of its dark recording, the phone cut last', () => {
  const source = readRepoFile('src/components/Clip.astro')
  const style = source.slice(source.indexOf('<style>'))
  const urls = [...style.matchAll(/url\('([^']+)'\)/g)].map(([, url]) => url)
  const night = pinned(media.hero, 'dark')
  const poster = (phone: boolean) =>
    night.variants.find((variant) => variant.phone === phone)?.poster
  expect(urls).toEqual([poster(false), poster(true)])
  expect(readRepoFile('src/components/home/Hero.astro')).toMatch(
    /<Clip name="hero" scheme="dark" class="hero-clip" priority \/>/,
  )
})
