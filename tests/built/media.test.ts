import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { media, pinned, SLOTS } from '../../src/media.ts'
import { SITE_URL } from '../../src/site.ts'
import { builtClips } from '../support/clip-policy.ts'
import { allows, directives, siteCsp } from '../support/headers.ts'
import { tags } from '../support/html.ts'
import { filesUnder, readRepoFile, REPO } from '../support/source-files.ts'

// Every clip a built page carries: its files exist, the policy lets the page load them, and
// nothing loads before it is needed or for the other colour scheme.

const csp = directives(siteCsp(readRepoFile('dist/_headers')))
const pages = filesUnder('dist').filter((file) => file.endsWith('.html'))
const pageUrl = (page: string) =>
  new URL(page.replace(/^dist\//, '').replace(/index\.html$/, ''), SITE_URL).href
const inBuild = (url: string, page: string) =>
  existsSync(join(REPO, 'dist', decodeURIComponent(new URL(url, pageUrl(page)).pathname)))
const preloads = (html: string) =>
  tags(html, 'link').filter(
    ({ attrs }) => attrs.get('rel') === 'preload' && attrs.get('as') === 'image',
  )

describe.each(pages)('%s', (page) => {
  const html = readRepoFile(page)
  const clips = builtClips(html)

  it('has no autoplay attribute', () => {
    expect(html).not.toMatch(/\bautoplay\b/i)
  })

  it('carries clips that load late and start from a script', () => {
    expect(clips.flatMap(({ problems }) => problems)).toEqual([])
  })

  it('has every poster and source in the build, and the policy allows them', () => {
    const images = [
      ...clips.flatMap(({ poster, posters }) => [poster ?? '', ...posters]),
      ...preloads(html).map(({ attrs }) => attrs.get('href') ?? ''),
    ]
    const videos = clips.flatMap(({ sources }) => sources)
    expect([...images, ...videos].filter((url) => !inBuild(url, page))).toEqual([])
    expect([
      ...images.filter((url) => !allows(csp.get('img-src') ?? [], url, pageUrl(page))),
      ...videos.filter((url) => !allows(csp.get('media-src') ?? [], url, pageUrl(page))),
    ]).toEqual([])
  })
})

it('offers every variant of every clip on the home page, with its posters', () => {
  const clips = builtClips(readRepoFile('dist/index.html'))
  // The home page wears the night in either scheme, so it carries the dark recordings only.
  const shown = SLOTS.map((name) => pinned(media[name], 'dark'))
  expect(clips).toHaveLength(shown.length)
  for (const slot of shown) {
    const last = slot.sources.at(-1)!.src
    const clip = clips.find(({ sources }) => sources.at(-1) === last)
    expect(clip?.sources, last).toEqual(slot.sources.map(({ src }) => src))
    expect(clip?.posters, last).toEqual(
      slot.variants.filter((variant) => variant.media).map((variant) => variant.poster),
    )
  }
})

it('preloads the hero poster once per variant, each for a query no other matches', () => {
  const links = preloads(readRepoFile('dist/index.html')).map(({ attrs }) => ({
    href: attrs.get('href'),
    media: attrs.get('media'),
  }))
  expect(links).toEqual(
    pinned(media.hero, 'dark').variants.map(({ poster, only }) => ({ href: poster, media: only })),
  )
})

it('styles the hero poster from the built stylesheet', () => {
  const css = filesUnder('dist/_astro')
    .filter((file) => file.endsWith('.css'))
    .map(readRepoFile)
    .join('\n')
  for (const { poster } of pinned(media.hero, 'dark').variants) expect(css).toContain(poster)
})

it('shows each poster as a picture of its variants when scripts do not run', () => {
  const html = readRepoFile('dist/index.html')
  const pictures = [...html.matchAll(/<noscript>\s*<picture\b[^>]*>([\s\S]*?)<\/picture>/g)].map(
    ([, inner = '']) => {
      const img = tags(inner, 'img')[0]?.attrs
      return {
        sources: tags(inner, 'source').map(({ attrs }) => attrs.get('srcset')),
        img: img?.get('src'),
        loading: img?.get('loading'),
      }
    },
  )
  const shown = SLOTS.filter((name) => media[name].clip).map((name) => ({
    slot: pinned(media[name], 'dark'),
    loading: name === 'hero' ? 'eager' : 'lazy',
  }))
  expect(pictures).toEqual(
    shown.map(({ slot, loading }) => ({
      sources: slot.variants.filter((v) => v.media).map((v) => v.poster),
      img: slot.poster,
      loading,
    })),
  )
})
