import { describe, expect, it } from 'vitest'
import type { DomEnv } from '../../src/lib/dom-env.ts'
import { initPosters } from '../../src/scripts/posters.ts'
import { fakeEnv, rootOf } from '../support/dom-fakes.ts'

const DARK = '(prefers-color-scheme: dark)'
const PHONE_DARK = '(max-width: 639.98px) and (prefers-color-scheme: dark)'

class FakePosterVideo {
  readonly attributes = new Map<string, string>()
  readonly dataset: Record<string, string | undefined>

  constructor(poster: string, variants: [string, string][] = []) {
    this.dataset = { poster, posterMedia: JSON.stringify(variants) }
  }

  get poster() {
    return this.attributes.get('poster') ?? ''
  }

  set poster(value: string) {
    this.attributes.set('poster', value)
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }
}

type Listener = (event: { matches: boolean }) => void

/** The fake page with media queries that match as `matching` says and can change. */
function mediaEnv(options: { reduced?: boolean; matching?: string[] } = {}) {
  const fake = fakeEnv(options)
  const matching = new Set(options.matching ?? [])
  const listeners = new Map<string, Set<Listener>>()
  const env: DomEnv = {
    ...fake.env,
    matchMedia: (query) => {
      if (query.includes('reduced-motion')) return fake.env.matchMedia(query)
      return {
        get matches() {
          return matching.has(query)
        },
        addEventListener: (_type: string, listener: unknown) => {
          const set = listeners.get(query) ?? new Set()
          set.add(listener as Listener)
          listeners.set(query, set)
        },
        removeEventListener: (_type: string, listener: unknown) =>
          listeners.get(query)?.delete(listener as Listener),
      }
    },
  }
  const set = (query: string, matches: boolean) => {
    if (matches) matching.add(query)
    else matching.delete(query)
    listeners.get(query)?.forEach((listener) => listener({ matches }))
  }
  const listening = () => [...listeners.values()].reduce((sum, each) => sum + each.size, 0)
  return { ...fake, env, set, listening }
}

const variants: [string, string][] = [
  [PHONE_DARK, '/a-phone-dark.webp'],
  [DARK, '/a-dark.webp'],
]

const setup = (
  options: { reduced?: boolean; matching?: string[] } = {},
  videos = [new FakePosterVideo('/a.webp', variants)],
) => {
  const page = mediaEnv(options)
  const stop = initPosters(rootOf(videos), {}, page.env)
  return { ...page, stop, videos, observer: page.observers[0], video: videos[0]! }
}

describe('initPosters', () => {
  it('sets no poster until the clip is near, looking a screen ahead', () => {
    const { video, observer } = setup()

    expect(video.poster).toBe('')
    expect(observer?.options).toEqual({ rootMargin: '600px 0px' })
    expect([...(observer?.observed ?? [])]).toEqual([video])
  })

  it('sets the poster once the clip comes near, and stops watching it', () => {
    const { video, observer } = setup()

    observer?.deliver({ target: video, isIntersecting: false })
    expect(video.poster).toBe('')
    observer?.deliver({ target: video, isIntersecting: true })

    expect(video.poster).toBe('/a.webp')
    expect(observer?.observed.size).toBe(0)
  })

  it('takes the first variant whose media query matches, as a picture would', () => {
    const dark = setup({ matching: [DARK] })
    dark.observer?.deliver({ target: dark.video, isIntersecting: true })
    const phone = setup({ matching: [DARK, PHONE_DARK] })
    phone.observer?.deliver({ target: phone.video, isIntersecting: true })

    expect([dark.video.poster, phone.video.poster]).toEqual(['/a-dark.webp', '/a-phone-dark.webp'])
  })

  it('switches a shown poster when the scheme changes, and leaves the others for later', () => {
    const videos = [
      new FakePosterVideo('/a.webp', variants),
      new FakePosterVideo('/b.webp', [[DARK, '/b-dark.webp']]),
    ]
    const { observer, set } = setup({}, videos)
    observer?.deliver({ target: videos[0], isIntersecting: true })

    set(DARK, true)
    expect(videos.map((video) => video.poster)).toEqual(['/a-dark.webp', ''])
    set(DARK, false)
    expect(videos[0]?.poster).toBe('/a.webp')
  })

  it('sets posters under reduced motion too, since they stand in for the clips', () => {
    const { video, observer } = setup({ reduced: true })

    observer?.deliver({ target: video, isIntersecting: true })

    expect(video.poster).toBe('/a.webp')
  })

  it('treats each clip on its own', () => {
    const videos = [new FakePosterVideo('/a.webp'), new FakePosterVideo('/b.webp')]
    const { observer } = setup({}, videos)

    observer?.deliver({ target: videos[1], isIntersecting: true })

    expect(videos.map((video) => video.poster)).toEqual(['', '/b.webp'])
  })

  it('creates nothing when no clip waits for its poster, and lets go of everything when stopped', () => {
    expect(setup({}, []).observers).toEqual([])

    const { observer, stop, listening } = setup()
    expect(listening()).toBeGreaterThan(0)
    stop()

    expect(observer?.disconnected).toBe(true)
    expect(listening()).toBe(0)
  })
})
