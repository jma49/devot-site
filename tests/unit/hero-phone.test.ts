import { describe, expect, it } from 'vitest'
import { mirrorPlayback } from '../../src/scripts/hero-phone.ts'
import { FakeSource } from '../support/dom-fakes.ts'
import { readRepoFile } from '../support/source-files.ts'

class FakeClip {
  paused = true
  loads = 0
  plays = 0
  rejectPlay = false
  readonly sources = [new FakeSource('/phone.mp4')]

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
}

describe('mirrorPlayback', () => {
  const mirror = () => {
    const lead = new FakeClip()
    const follower = new FakeClip()
    let refused = 0
    const mirrored = mirrorPlayback(
      lead as unknown as HTMLVideoElement,
      follower as unknown as HTMLVideoElement,
      () => refused++,
    )
    const play = () => {
      lead.paused = false
      lead.emit('playing')
    }
    const rest = () => {
      lead.paused = true
      lead.emit('pause')
    }
    return { lead, follower, mirrored, play, rest, refused: () => refused }
  }

  it('asks for nothing until the lead plays', () => {
    const { follower } = mirror()
    expect(follower.loads).toBe(0)
    expect(follower.sources[0]?.src).toBe('')
  })

  it('loads the follower once and plays it with the lead', () => {
    const { follower, play } = mirror()
    play()
    expect(follower.sources[0]?.src).toBe('/phone.mp4')
    expect(follower.loads).toBe(1)
    expect(follower.paused).toBe(false)
    play()
    expect(follower.loads).toBe(1)
    expect(follower.plays).toBe(1)
  })

  it('rests with the lead and picks up again', () => {
    const { follower, play, rest } = mirror()
    play()
    rest()
    expect(follower.paused).toBe(true)
    play()
    expect(follower.paused).toBe(false)
    expect(follower.loads).toBe(1)
  })

  it('starts at once beside a lead that is already playing', () => {
    const lead = new FakeClip()
    const follower = new FakeClip()
    lead.paused = false
    mirrorPlayback(lead as unknown as HTMLVideoElement, follower as unknown as HTMLVideoElement)
    expect(follower.paused).toBe(false)
  })

  it('reports a browser that will not play the follower, once, and stops asking', async () => {
    const { follower, play, rest, refused } = mirror()
    follower.rejectPlay = true
    play()
    await Promise.resolve()
    await Promise.resolve()
    rest()
    play()
    await Promise.resolve()
    expect(refused()).toBe(1)
    expect(follower.plays).toBe(1)
  })

  it('lets go of the lead when stopped', () => {
    const { lead, follower, mirrored, play } = mirror()
    play()
    mirrored.stop()
    expect(follower.paused).toBe(true)
    expect(lead.listening()).toBe(0)
  })
})

describe('the hero', () => {
  const template = readRepoFile('src/components/home/Hero.astro')

  it('shows one recording of the window and one of the iPhone, the dark ones', () => {
    expect(template.match(/<Clip /g)).toHaveLength(1)
    expect(template).toContain('<Clip name="hero" scheme="dark" class="hero-clip" priority />')
    expect(template.match(/<video/g)).toHaveLength(1)
    expect(template).toMatch(/import reading from '[^']*p2-read-dark\.mp4\?url'/)
  })

  it('leaves the appearance to the page, which wears the night', () => {
    expect(template).not.toContain('data-scope')
    expect(readRepoFile('src/pages/index.astro')).toMatch(/<Base night /)
  })
})
