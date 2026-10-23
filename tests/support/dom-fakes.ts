import type { DomEnv } from '../../src/lib/dom-env.ts'

type Listener = (event: { matches: boolean }) => void

export class FakeObserver {
  observed = new Set<unknown>()
  disconnected = false

  private readonly callback: IntersectionObserverCallback
  readonly options: IntersectionObserverInit

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
  }

  observe(target: unknown) {
    this.observed.add(target)
  }

  unobserve(target: unknown) {
    this.observed.delete(target)
  }

  disconnect() {
    this.observed.clear()
    this.disconnected = true
  }

  /** Delivers one batch of entries, as the browser does after layout. */
  deliver(...entries: { target: unknown; isIntersecting: boolean }[]) {
    this.callback(entries as unknown as IntersectionObserverEntry[], this as never)
  }
}

export interface FakeEnv {
  env: DomEnv
  observers: FakeObserver[]
  setReducedMotion(reduced: boolean): void
  setPageHidden(hidden: boolean): void
  reducedListeners: Set<Listener>
  visibilityListeners: Set<() => void>
}

export function fakeEnv(initial: { reduced?: boolean; hidden?: boolean } = {}): FakeEnv {
  const observers: FakeObserver[] = []
  const reducedListeners = new Set<Listener>()
  const visibilityListeners = new Set<() => void>()
  const state = { reduced: initial.reduced ?? false, hidden: initial.hidden ?? false }
  const env: DomEnv = {
    createObserver: (callback, options) => {
      const observer = new FakeObserver(callback, options)
      observers.push(observer)
      return observer as never
    },
    matchMedia: () => ({
      get matches() {
        return state.reduced
      },
      addEventListener: (_type: string, listener: unknown) =>
        reducedListeners.add(listener as Listener),
      removeEventListener: (_type: string, listener: unknown) =>
        reducedListeners.delete(listener as Listener),
    }),
    pageHidden: () => state.hidden,
    onPageVisibility: (handler) => {
      visibilityListeners.add(handler)
      return () => visibilityListeners.delete(handler)
    },
  }
  return {
    env,
    observers,
    reducedListeners,
    visibilityListeners,
    setReducedMotion(reduced) {
      state.reduced = reduced
      reducedListeners.forEach((listener) => listener({ matches: reduced }))
    },
    setPageHidden(hidden) {
      state.hidden = hidden
      visibilityListeners.forEach((listener) => listener())
    },
  }
}

export class FakeElement {
  readonly attributes = new Map<string, string>()
  readonly properties = new Map<string, string>()
  readonly style = {
    setProperty: (name: string, value: string) => this.properties.set(name, value),
  }

  readonly dataset: Record<string, string>

  constructor(dataset: Record<string, string> = {}) {
    this.dataset = dataset
  }

  hasAttribute(name: string) {
    return this.attributes.has(name)
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

export class FakeSource {
  src = ''
  readonly dataset: Record<string, string | undefined>

  constructor(src: string) {
    this.dataset = { src }
  }

  removeAttribute(name: string) {
    if (name === 'data-src') delete this.dataset['src']
  }
}

export class FakeVideo {
  paused = true
  preload = 'none'
  loads = 0
  plays = 0
  pauses = 0
  rejectPlay = false
  readonly dataset = { clip: 'hero' }
  readonly sources: FakeSource[]

  constructor(sources: FakeSource[] = [new FakeSource('/a.mp4'), new FakeSource('/a.webm')]) {
    this.sources = sources
  }

  querySelectorAll() {
    return this.sources.filter((source) => source.dataset['src'] !== undefined)
  }

  load() {
    this.loads++
  }

  play() {
    this.plays++
    this.paused = false
    return this.rejectPlay ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve()
  }

  pause() {
    this.pauses++
    this.paused = true
  }
}

export function rootOf(elements: unknown[]): ParentNode {
  return { querySelectorAll: () => elements } as unknown as ParentNode
}
