import { expect, it } from 'vitest'
import { builtClips } from '../support/clip-policy.ts'

const clip = (attrs = '', sources = '<source data-src="/a.mp4" type="video/mp4">') =>
  `<video data-clip="hero" width="2" height="1" poster="/a.webp" muted loop playsinline preload="none" ${attrs}>${sources}</video>`

it('reads the poster and the deferred sources of a clip', () => {
  const html = clip('', '<source data-src="/a.mp4" type="video/mp4"><source data-src="/a.webm">')
  expect(builtClips(html)).toEqual([
    { poster: '/a.webp', sources: ['/a.mp4', '/a.webm'], problems: [] },
  ])
})

it('reads a deferred poster as the poster', () => {
  expect(builtClips(clip().replace(' poster=', ' data-poster='))[0]?.poster).toBe('/a.webp')
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
  expect(problems(clip('autoplay'))).toEqual(['video 1 has autoplay'])
  expect(problems(clip('').replace(' preload="none"', ''))).toEqual(['lacks preload="none"'])
  expect(problems(clip('', ''))).toEqual(['has no source with data-src'])
  expect(problems(clip('').replace(' playsinline', ''))).toEqual(['video 1 lacks playsinline'])
})
