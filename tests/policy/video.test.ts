import { expect, it } from 'vitest'
import { filesUnder, readRepoFile } from '../support/source-files.ts'
import { videoProblems } from '../support/video-policy.ts'

// Clips start in src/scripts/clips.ts, only while in view, never from an attribute.

const sources = filesUnder('src').filter((file) => /\.(astro|ts|css|html)$/.test(file))

it('every <video> in a template has muted, loop, playsinline, a poster and its size', () => {
  const offenders = sources
    .filter((file) => file.endsWith('.astro'))
    .flatMap((file) => videoProblems(readRepoFile(file)).map((problem) => `${file}: ${problem}`))
  expect(offenders).toEqual([])
})

it('no source file asks for autoplay', () => {
  const offenders = sources.filter((file) => /\bautoplay\b/i.test(readRepoFile(file)))
  expect(offenders).toEqual([])
})

it('finds a video that lacks an attribute or autoplays', () => {
  const complete =
    '<video src="/a.mp4" poster="/a.webp" width="2" height="1" muted loop playsinline></video>'
  expect(videoProblems(complete)).toEqual([])
  expect(
    videoProblems('<video src="/a.mp4" muted loop poster="/a.webp" width="2"></video>'),
  ).toEqual(['video 1 lacks playsinline', 'video 1 lacks height'])
  expect(videoProblems(`${complete}${complete.replace('muted', 'muted autoplay')}`)).toEqual([
    'video 2 has autoplay',
  ])
  expect(videoProblems('<p>no video</p>')).toEqual([])
})
