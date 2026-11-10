import { describe, expect, it } from 'vitest'
import { followClip, NIGHT_DRIFT } from '../../src/scripts/hero-night.ts'
import { media } from '../../src/media.ts'
import { FakeSource } from '../support/dom-fakes.ts'
import { readRepoFile } from '../support/source-files.ts'

class FakeClip {
  currentTime = 0
  paused = true
  loads = 0
  plays = 0
  rejectPlay = false
  readonly sources = [new FakeSource('/night.webm'), new FakeSource('/night.mp4')]
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener())
  }

  listening() {
    return [...this.listeners.values()].reduce((count, set) => count + set.size, 0)
  }

  querySelectorAll() {
    return this.sources.filter((source) => source.dataset['src'] !== undefined)
  }

  load() {
    this.loads++
  }

  play() {
    this.plays++
    if (this.rejectPlay) return Promise.reject(new Error('NotAllowedError'))
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
  }
}

const pair = () => {
  const clip = new FakeClip()
  const night = new FakeClip()
  const refused: number[] = []
  const follow = followClip(
    clip as unknown as HTMLVideoElement,
    night as unknown as HTMLVideoElement,
    () => refused.push(1),
  )
  const start = (at: number) => {
    clip.currentTime = at
    clip.paused = false
    clip.emit('playing')
  }
  return { clip, night, refused, follow, start }
}

describe('followClip', () => {
  it('requests nothing until the hero clip plays', () => {
    const { night } = pair()
    expect(night.loads).toBe(0)
    expect(night.plays).toBe(0)
    expect(night.sources.map((source) => source.src)).toEqual(['', ''])
  })

  it('loads the night recording once, and plays it from the moment the clip is at', () => {
    const { clip, night, start } = pair()
    start(4.2)
    expect(night.sources.map((source) => source.src)).toEqual(['/night.webm', '/night.mp4'])
    expect(night.loads).toBe(1)
    expect(night.currentTime).toBe(4.2)
    expect(night.paused).toBe(false)
    clip.emit('playing')
    expect(night.loads).toBe(1)
  })

  it('pauses with the clip, on the same moment', () => {
    const { clip, night, start } = pair()
    start(1)
    clip.currentTime = 7.5
    clip.paused = true
    clip.emit('pause')
    expect(night.paused).toBe(true)
    expect(night.currentTime).toBe(7.5)
  })

  it('goes back with the clip when it loops, and catches up when it has drifted', () => {
    const { clip, night, start } = pair()
    start(17)
    night.currentTime = 17.9
    clip.currentTime = 0
    clip.emit('seeked')
    expect(night.currentTime).toBe(0)

    night.currentTime = 3
    clip.currentTime = 3 + NIGHT_DRIFT / 2
    clip.emit('timeupdate')
    expect(night.currentTime).toBe(3)
    clip.currentTime = 3 + NIGHT_DRIFT * 2
    clip.emit('timeupdate')
    expect(night.currentTime).toBe(3 + NIGHT_DRIFT * 2)
  })

  it('starts at once when the clip is already playing', () => {
    const clip = new FakeClip()
    const night = new FakeClip()
    clip.paused = false
    clip.currentTime = 2
    followClip(clip as unknown as HTMLVideoElement, night as unknown as HTMLVideoElement, () => {})
    expect(night.paused).toBe(false)
    expect(night.currentTime).toBe(2)
  })

  it('rests while the night is gone, and picks the clip up again after', () => {
    const { clip, night, follow, start } = pair()
    start(1)
    follow.rest(true)
    expect(night.paused).toBe(true)
    clip.currentTime = 6
    clip.emit('timeupdate')
    expect(night.paused).toBe(true)
    follow.rest(false)
    expect(night.paused).toBe(false)
    expect(night.currentTime).toBe(6)
  })

  it('does not load a recording that rests before the clip ever played', () => {
    const { night, follow, start } = pair()
    follow.rest(true)
    start(1)
    expect(night.loads).toBe(0)
  })

  it('reports a browser that will not play it, once', async () => {
    const { clip, night, refused, start } = pair()
    night.rejectPlay = true
    start(1)
    await Promise.resolve()
    await Promise.resolve()
    expect(refused).toEqual([1])
    clip.emit('playing')
    await Promise.resolve()
    expect(refused).toEqual([1])
    expect(night.plays).toBe(1)
  })

  it('lets go of the clip when stopped', () => {
    const { clip, night, follow, start } = pair()
    start(1)
    follow.stop()
    expect(night.paused).toBe(true)
    expect(clip.listening()).toBe(0)
  })
})

describe('the night over the hero clip', () => {
  const css = readRepoFile('src/styles/home/hero.css')
  const template = readRepoFile('src/components/home/Hero.astro')

  it('paints the dark posters of the hero slot first, the phone cut on a phone', () => {
    const night = media.hero.variants.filter(({ scheme }) => scheme === 'dark')
    expect(night.map(({ phone }) => phone).toSorted()).toEqual([false, true])
    for (const { poster } of night) expect(css).toContain(`url('${poster}')`)
    expect(css.match(/url\('\/media\/hero\/[^']+'\)/g)).toHaveLength(night.length)
  })

  it('is drawn only on a light page that runs scripts', () => {
    const hidden = (query: string) =>
      new RegExp(
        `@media \\(${query}\\) \\{\\s*\\.hero-night,\\s*\\.hero-phone-night \\{\\s*display: none;`,
      )
    expect(css).toMatch(hidden('prefers-color-scheme: dark'))
    expect(css).toMatch(hidden('scripting: none'))
  })

  it('opens under the night without waiting for a script, and stays out of the clip system', () => {
    expect(template).toMatch(/data-scope="dark"\s+data-appearance-preview="dark"/)
    const cover =
      /<div class="hero-night" data-hero-night aria-hidden="true">([\s\S]*?)<\/div>/.exec(
        template,
      )?.[1]
    expect(cover).toContain('preload="none"')
    expect(cover).toContain('tabindex="-1"')
    expect(cover).toContain('data-src={src}')
    expect(cover).not.toContain('data-clip')
  })
})
