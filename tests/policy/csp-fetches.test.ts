import { describe, expect, it } from 'vitest'
import { fetches } from '../support/csp-fetches.ts'

const sorted = (html: string) =>
  fetches(html)
    .map(({ directive, url }) => `${directive} ${url}`)
    .toSorted()

describe('fetches', () => {
  it('maps scripts, stylesheets, icons and the manifest', () => {
    const html = `
      <script type="module" src="/a.js"></script>
      <link rel="stylesheet" href="/a.css">
      <link rel="icon" href="/favicon.svg" type="image/svg+xml">
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="manifest" href="/site.webmanifest">
      <link rel="modulepreload" href="/b.js">`
    expect(sorted(html)).toEqual([
      'img-src /favicon.svg',
      'img-src /touch.png',
      'manifest-src /site.webmanifest',
      'script-src /a.js',
      'script-src /b.js',
      'style-src /a.css',
    ])
  })

  it('maps a preload by what it loads, and marks one it cannot place as unknown', () => {
    const html = ['style', 'font', 'image', 'fetch', 'script', 'video', 'track', 'document']
      .map((as) => `<link rel="preload" as="${as}" href="/${as}">`)
      .concat('<link rel="preload" href="/none">')
      .join('\n')
    expect(sorted(html)).toEqual([
      'connect-src /fetch',
      'font-src /font',
      'img-src /image',
      'media-src /track',
      'media-src /video',
      'script-src /script',
      'style-src /style',
      'unknown /document',
      'unknown /none',
    ])
  })

  it('maps images, srcset candidates and <picture> sources to img-src', () => {
    const html = `
      <img src="/a.png" srcset="/a-1x.png 1x, /a-2x.png 2x" alt="">
      <picture><source srcset="/p.avif" type="image/avif"><img src="/p.png" alt=""></picture>`
    expect(sorted(html)).toEqual([
      'img-src /a-1x.png',
      'img-src /a-2x.png',
      'img-src /a.png',
      'img-src /p.avif',
      'img-src /p.png',
    ])
  })

  it('maps video and audio, with their sources and tracks, to media-src and a poster to img-src', () => {
    const html = `
      <video src="/v.mp4" poster="/v.jpg" muted>
        <source src="/v.webm" type="video/webm">
        <track src="/v.vtt" kind="captions">
      </video>
      <audio controls><source src="/a.mp3" type="audio/mpeg"></audio>`
    expect(sorted(html)).toEqual([
      'img-src /v.jpg',
      'media-src /a.mp3',
      'media-src /v.mp4',
      'media-src /v.vtt',
      'media-src /v.webm',
    ])
  })

  it('maps frames and embedded objects, and ignores links that fetch nothing', () => {
    const html = `
      <iframe src="/f.html" title="f"></iframe>
      <object data="/o.pdf"></object>
      <link rel="canonical" href="https://devot.online/">
      <link rel="sitemap" href="/sitemap-index.xml">
      <a href="/x">x</a>`
    expect(sorted(html)).toEqual(['frame-src /f.html', 'object-src /o.pdf'])
  })
})
