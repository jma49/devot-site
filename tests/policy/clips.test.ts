import { expect, it } from 'vitest'
import { builtClips } from '../support/clip-policy.ts'

const DARK = '(prefers-color-scheme: dark)'
const variants = JSON.stringify([[DARK, '/a-dark.webp']]).replaceAll('"', '&quot;')
const clip = (attrs = '', sources = '<source data-src="/a.mp4" type="video/mp4">') =>
  `<video data-clip="hero" width="2" height="1" data-poster="/a.webp" data-poster-media="${variants}" muted loop playsinline preload="none" ${attrs}>${sources}</video>`

it('reads the posters and the deferred sources of a clip', () => {
  const html = clip(
    '',
    `<source data-src="/a-dark.webm" media="${DARK}"><source data-src="/a.mp4"><source data-src="/a.webm">`,
  )
  expect(builtClips(html)).toEqual([
    {
      poster: '/a.webp',
      posters: ['/a-dark.webp'],
      sources: ['/a-dark.webm', '/a.mp4', '/a.webm'],
      problems: [],
    },
  ])
})

it('ignores videos that are not clips', () => {
  expect(builtClips('<video src="/a.mp4" controls></video><p>text</p>')).toEqual([])
})

it('finds a clip that would load early, or autoplay, or lacks an attribute', () => {
  const problems = (html: string) => builtClips(html)[0]?.problems
  expect(problems(clip('src="/a.mp4"'))).toEqual(['has a src, so the clip loads at once'])
  expect(problems(clip('', '<source src="/a.mp4"><source data-src="/a.webm">'))).toEqual([
    'has a src, so the clip loads at once',
  ])
  expect(problems(clip('poster="/a.webp"'))).toEqual([
    'has a poster, so it loads at once in every scheme',
  ])
  expect(problems(clip('autoplay'))).toEqual(['video 1 has autoplay'])
  expect(problems(clip('').replace(' preload="none"', ''))).toEqual(['lacks preload="none"'])
  expect(problems(clip('', ''))).toEqual(['has no source with data-src'])
  expect(problems(clip('').replace(' playsinline', ''))).toEqual(['video 1 lacks playsinline'])
})
