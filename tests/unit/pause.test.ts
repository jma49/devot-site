import { describe, expect, it } from 'vitest'
import {
  bindPauseToggles,
  createPause,
  PAUSE_ATTRIBUTE,
  PAUSE_KEY,
  pausedQuery,
} from '../../src/scripts/pause.ts'

class MemoryStorage {
  readonly items = new Map<string, string>()
  failing = false

  getItem(key: string) {
    if (this.failing) throw new Error('SecurityError')
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.failing) throw new Error('QuotaExceededError')
    this.items.set(key, value)
  }
}

class FakeRoot {
  readonly attributes = new Set<string>()

  toggleAttribute(name: string, force: boolean) {
    if (force) this.attributes.add(name)
    else this.attributes.delete(name)
    return force
  }
}

const host = (stored?: string) => {
  const storage = new MemoryStorage()
  if (stored !== undefined) storage.items.set(PAUSE_KEY, stored)
  return { storage, events: new EventTarget(), root: new FakeRoot() }
}

describe('createPause', () => {
  it('starts running, or paused when the choice was remembered', () => {
    expect(createPause(host()).paused).toBe(false)
    expect(createPause(host('false')).paused).toBe(false)
    expect(createPause(host('true')).paused).toBe(true)
  })

  it('remembers the choice and marks the page while paused', () => {
    const parts = host()
    const pause = createPause(parts)

    pause.set(true)
    expect([pause.paused, parts.storage.items.get(PAUSE_KEY)]).toEqual([true, 'true'])
    expect(parts.root.attributes.has(PAUSE_ATTRIBUTE)).toBe(true)
    pause.set(false)

    expect([pause.paused, parts.storage.items.get(PAUSE_KEY)]).toEqual([false, 'false'])
    expect(parts.root.attributes.has(PAUSE_ATTRIBUTE)).toBe(false)
  })

  it('marks the page at once when the remembered choice is to pause', () => {
    const parts = host('true')
    createPause(parts)
    expect(parts.root.attributes.has(PAUSE_ATTRIBUTE)).toBe(true)
  })

  it('tells subscribers about each change, once, until they unsubscribe', () => {
    const pause = createPause(host())
    const heard: boolean[] = []
    const stop = pause.subscribe((paused) => heard.push(paused))

    pause.set(true)
    pause.set(true)
    pause.set(false)
    stop()
    pause.set(true)

    expect(heard).toEqual([true, false])
  })

  it('keeps every copy on the page in step, whichever one changes', () => {
    const parts = host()
    const header = createPause(parts)
    const clips = createPause(parts)
    const heard: boolean[] = []
    clips.subscribe((paused) => heard.push(paused))

    header.set(true)

    expect([clips.paused, heard]).toEqual([true, [true]])
  })

  it('still pauses for this visit when storage is refused', () => {
    const parts = host()
    parts.storage.failing = true
    const pause = createPause(parts)

    pause.set(true)

    expect(pause.paused).toBe(true)
  })

  it('works without storage at all', () => {
    const pause = createPause({ ...host(), storage: null })
    pause.set(true)
    expect(pause.paused).toBe(true)
  })
})

describe('pausedQuery', () => {
  it('matches while animations are paused, whatever the motion setting', () => {
    const pause = createPause(host())
    const paused = pausedQuery(pause)

    expect(paused.matches).toBe(false)
    pause.set(true)
    expect(paused.matches).toBe(true)
    pause.set(false)
    expect(paused.matches).toBe(false)
  })

  it('reports each change once to each listener, until it is removed', () => {
    const pause = createPause(host())
    const paused = pausedQuery(pause)
    const heard: boolean[] = []
    const listener = (event: { matches: boolean }) => heard.push(event.matches)
    paused.addEventListener('change', listener)
    paused.addEventListener('change', listener)

    pause.set(true)
    pause.set(true)
    pause.set(false)

    expect(heard).toEqual([true, false])
    paused.removeEventListener('change', listener)
    pause.set(true)
    expect(heard).toEqual([true, false])
  })

  it('hears a change made through another copy of the pause', () => {
    const shared = host()
    const paused = pausedQuery(createPause(shared))
    const heard: boolean[] = []
    paused.addEventListener('change', (event: { matches: boolean }) => heard.push(event.matches))

    createPause(shared).set(true)

    expect([paused.matches, heard]).toEqual([true, [true]])
  })
})

class FakeToggle {
  readonly attributes = new Map<string, string>()
  readonly listeners = new Set<() => void>()

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  addEventListener(_type: string, listener: () => void) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: () => void) {
    this.listeners.delete(listener)
  }

  click() {
    this.listeners.forEach((listener) => listener())
  }
}

describe('bindPauseToggles', () => {
  it('shows the state on every toggle and flips it from any of them', () => {
    const pause = createPause(host())
    const toggles = [new FakeToggle(), new FakeToggle()]
    bindPauseToggles(toggles as unknown as HTMLButtonElement[], pause)

    expect(toggles.map((toggle) => toggle.attributes.get('aria-pressed'))).toEqual([
      'false',
      'false',
    ])
    toggles[1]?.click()

    expect(pause.paused).toBe(true)
    expect(toggles.map((toggle) => toggle.attributes.get('aria-pressed'))).toEqual(['true', 'true'])
    toggles[0]?.click()
    expect(pause.paused).toBe(false)
  })

  it('starts pressed when the page opens paused, and lets go when unbound', () => {
    const pause = createPause(host('true'))
    const toggle = new FakeToggle()
    const unbind = bindPauseToggles([toggle] as unknown as HTMLButtonElement[], pause)
    expect(toggle.attributes.get('aria-pressed')).toBe('true')

    unbind()
    toggle.click()
    pause.set(false)

    expect(toggle.attributes.get('aria-pressed')).toBe('true')
  })
})
