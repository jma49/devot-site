import { describe, expect, it } from 'vitest'
import { keepInStep, STEP_DRIFT, STEP_LEAD } from '../../src/scripts/hero-day.ts'
import { readRepoFile } from '../support/source-files.ts'

class FakeClip {
  currentTime = 0
  readyState = 0
  seeking = false
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

const pair = () => {
  const lead = new FakeClip()
  const follower = new FakeClip()
  let readied = 0
  const step = keepInStep(
    lead as unknown as HTMLVideoElement,
    follower as unknown as HTMLVideoElement,
    () => readied++,
  )
  return { lead, follower, step, readied: () => readied }
}

describe('keepInStep', () => {
  it('puts the follower on the moment the lead is at, before it has loaded', () => {
    const lead = new FakeClip()
    const follower = new FakeClip()
    lead.currentTime = 6.4
    const step = keepInStep(
      lead as unknown as HTMLVideoElement,
      follower as unknown as HTMLVideoElement,
      () => {},
    )
    expect(follower.currentTime).toBe(6.4)
    expect(step.ready()).toBe(false)
  })

  it('is ready once the follower has a frame of that moment, and says so once', () => {
    const { lead, follower, step, readied } = pair()
    lead.currentTime = 3
    lead.emit('timeupdate')
    expect(step.ready()).toBe(false)

    follower.readyState = 2
    follower.seeking = true
    follower.emit('loadeddata')
    expect(step.ready()).toBe(false)

    follower.seeking = false
    follower.emit('seeked')
    expect(step.ready()).toBe(true)
    follower.emit('playing')
    lead.emit('timeupdate')
    expect(readied()).toBe(1)
  })

  it('leaves a follower that keeps time alone, and moves one that has drifted', () => {
    const { lead, follower } = pair()
    follower.currentTime = 5
    lead.currentTime = 5 + STEP_DRIFT / 2
    lead.emit('timeupdate')
    expect(follower.currentTime).toBe(5)

    lead.currentTime = 5 + STEP_DRIFT * 2
    lead.emit('timeupdate')
    expect(follower.currentTime).toBe(5 + STEP_DRIFT * 2)
  })

  it('goes back with the lead when it loops', () => {
    const { lead, follower } = pair()
    lead.currentTime = 18.2
    lead.emit('timeupdate')
    lead.currentTime = 0.02
    lead.emit('seeked')
    expect(follower.currentTime).toBe(0.02)
  })

  it('starts from the lead again after the follower has been away', () => {
    const { lead, follower } = pair()
    follower.readyState = 4
    lead.currentTime = 9
    follower.currentTime = 2
    follower.emit('playing')
    expect(follower.currentTime).toBe(9)
  })

  it('starts no seek while one is under way', () => {
    const { lead, follower } = pair()
    lead.currentTime = 4
    lead.emit('timeupdate')
    expect(follower.currentTime).toBe(4)

    follower.seeking = true
    lead.currentTime = 4.5
    lead.emit('timeupdate')
    lead.currentTime = 0
    lead.emit('seeked')
    expect(follower.currentTime).toBe(4)
  })

  it('aims the next seek ahead by as far as the lead moved on during the last', () => {
    const { lead, follower, step } = pair()
    lead.currentTime = 4
    lead.emit('timeupdate')
    follower.seeking = true

    lead.currentTime = 4.6
    follower.seeking = false
    follower.emit('seeked')
    expect(follower.currentTime).toBeCloseTo(4.6 + 0.6)
    expect(step.ready()).toBe(false)

    follower.seeking = true
    follower.readyState = 4
    lead.currentTime = 5.15
    follower.seeking = false
    follower.emit('seeked')
    expect(follower.currentTime).toBeCloseTo(5.2)
    expect(step.ready()).toBe(true)
  })

  it('never aims further ahead than a seek should take', () => {
    const { lead, follower } = pair()
    lead.currentTime = 2
    lead.emit('timeupdate')
    follower.seeking = true
    lead.currentTime = 9
    follower.seeking = false
    follower.emit('seeked')
    expect(follower.currentTime).toBe(9 + STEP_LEAD)
  })

  it('lets go of both when stopped', () => {
    const { lead, follower, step } = pair()
    step.stop()
    expect(lead.listening()).toBe(0)
    expect(follower.listening()).toBe(0)
  })
})

describe('the day over the hero clip', () => {
  const css = readRepoFile('src/styles/home/hero.css')
  const template = readRepoFile('src/components/home/Hero.astro')

  it('opens under the night without waiting for a script', () => {
    expect(template).toMatch(/data-scope="dark"\s+data-appearance-preview="dark"/)
    expect(css).toMatch(/--hero-night: 1;\s+--hero-daylight: 0;/)
  })

  it('keeps the light recording out of the page until a script shows it, and off a dark page', () => {
    expect(template).toMatch(
      /<div class="hero-day" data-hero-day hidden>\s*<Clip name="hero" scheme="light" as="hero-day" class="hero-clip" \/>/,
    )
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\s*\.hero-day,\s*\.hero-phone-day \{\s*display: none;/,
    )
  })
})
