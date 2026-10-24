import { describe, expect, it } from 'vitest'
import type { MediaQueryLike } from '../../src/lib/dom-env.ts'
import { initClips } from '../../src/scripts/clips.ts'
import { fakeEnv, FakeSource, FakeVideo, rootOf } from '../support/dom-fakes.ts'

const DARK = '(prefers-color-scheme: dark)'

const setup = (
  options: { reduced?: boolean; hidden?: boolean } = {},
  videos = [new FakeVideo()],
) => {
  const fake = fakeEnv(options)
  const stop = initClips(rootOf(videos), {}, fake.env)
  const [warm, watch] = fake.observers
  return { ...fake, stop, videos, warm, watch, video: videos[0] as FakeVideo }
}

describe('initClips', () => {
  it('requests no file and plays nothing until a clip is near or in view', () => {
    const { video, warm, watch } = setup()

    expect(video.querySelectorAll().map((source) => source.dataset['src'])).toEqual([
      '/a.mp4',
      '/a.webm',
    ])
    expect([video.preload, video.loads, video.plays]).toEqual(['none', 0, 0])
    expect([...(warm?.observed ?? [])]).toEqual([video])
    expect([...(watch?.observed ?? [])]).toEqual([video])
  })

  it('looks a screen ahead for loading and plays as soon as any part of the clip shows', () => {
    const { warm, watch } = setup()

    expect(warm?.options).toEqual({ rootMargin: '600px 0px' })
    expect(watch?.options).toEqual({ threshold: 0 })
  })

  it('loads the sources once, when the clip comes near, and stops watching for that', () => {
    const { video, warm } = setup()

    warm?.deliver({ target: video, isIntersecting: false })
    expect(video.loads).toBe(0)
    warm?.deliver({ target: video, isIntersecting: true })

    expect(video.sources.map((source) => source.src)).toEqual(['/a.mp4', '/a.webm'])
    expect(video.sources.map((source) => source.dataset['src'])).toEqual([undefined, undefined])
    expect([video.preload, video.loads, video.plays]).toEqual(['auto', 1, 0])
    expect(warm?.observed.size).toBe(0)
  })

  it('plays while in view, loading first if it has not, and pauses when it leaves', () => {
    const { video, watch } = setup()

    watch?.deliver({ target: video, isIntersecting: true })
    expect([video.paused, video.loads, video.plays]).toEqual([false, 1, 1])
    watch?.deliver({ target: video, isIntersecting: false })

    expect([video.paused, video.pauses]).toEqual([true, 1])
    expect(video.loads).toBe(1)
  })

  it('treats each clip on its own', () => {
    const videos = [new FakeVideo(), new FakeVideo()]
    const { watch } = setup({}, videos)

    watch?.deliver(
      { target: videos[0], isIntersecting: true },
      { target: videos[1], isIntersecting: true },
    )
    watch?.deliver({ target: videos[0], isIntersecting: false })

    expect(videos.map((video) => video.paused)).toEqual([true, false])
  })

  it('keeps going when the browser refuses to play', async () => {
    const { video, watch } = setup()
    video.rejectPlay = true

    watch?.deliver({ target: video, isIntersecting: true })

    await new Promise((resolve) => setTimeout(resolve))
    expect(video.plays).toBe(1)
  })

  it('pauses clips in view while the tab is hidden and resumes them when it is shown', () => {
    const { video, watch, setPageHidden } = setup()
    watch?.deliver({ target: video, isIntersecting: true })

    setPageHidden(true)
    expect(video.paused).toBe(true)
    setPageHidden(false)

    expect([video.paused, video.plays]).toEqual([false, 2])
  })

  it('does not play a clip that scrolled out of view while the tab was hidden', () => {
    const { video, watch, setPageHidden } = setup()
    watch?.deliver({ target: video, isIntersecting: true })
    setPageHidden(true)
    watch?.deliver({ target: video, isIntersecting: false })

    setPageHidden(false)

    expect([video.paused, video.plays]).toEqual([true, 1])
  })

  it('leaves the poster alone under reduced motion: nothing observed, loaded or played', () => {
    const { video, observers } = setup({ reduced: true })

    expect(observers).toEqual([])
    expect([video.loads, video.plays, video.sources[0]?.src]).toEqual([0, 0, ''])
  })

  it('stops and pauses when reduced motion is turned on, and starts again when it is turned off', () => {
    const { video, observers, watch, setReducedMotion } = setup()
    watch?.deliver({ target: video, isIntersecting: true })

    setReducedMotion(true)
    expect([video.paused, watch?.disconnected]).toEqual([true, true])
    setReducedMotion(false)

    expect(observers).toHaveLength(4)
    expect([...(observers[3]?.observed ?? [])]).toEqual([video])
  })

  it('disconnects, pauses and unsubscribes when stopped', () => {
    const { video, observers, stop, reducedListeners, visibilityListeners } = setup()

    stop()

    expect(observers.every((observer) => observer.disconnected)).toBe(true)
    expect(video.paused).toBe(true)
    expect([reducedListeners.size, visibilityListeners.size]).toEqual([0, 0])
  })

  it('loads a clip again when the scheme or width its sources are for changes', () => {
    const fake = fakeEnv()
    const listeners = new Map<string, (event: { matches: boolean }) => void>()
    const env = {
      ...fake.env,
      matchMedia: (query: string) =>
        query.includes('reduced-motion')
          ? fake.env.matchMedia(query)
          : {
              matches: false,
              addEventListener: (_: string, listener: unknown) =>
                listeners.set(query, listener as (event: { matches: boolean }) => void),
              removeEventListener: () => listeners.delete(query),
            },
    }
    const dark = Object.assign(new FakeSource('/a-dark.webm'), { media: DARK })
    const near = new FakeVideo([dark, new FakeSource('/a.webm')])
    const far = new FakeVideo([Object.assign(new FakeSource('/b-dark.webm'), { media: DARK })])
    const stop = initClips(rootOf([near, far]), {}, env)
    const [warm, watch] = fake.observers
    warm?.deliver({ target: near, isIntersecting: true })
    watch?.deliver({ target: near, isIntersecting: true })

    listeners.get(DARK)?.({ matches: true })

    expect([near.loads, near.plays, near.paused]).toEqual([2, 2, false])
    expect([far.loads, far.plays]).toEqual([0, 0])
    stop()
    expect(listeners.size).toBe(0)
  })

  it('selects video[data-clip] only', () => {
    const selectors: string[] = []
    const root = {
      querySelectorAll: (selector: string) => (selectors.push(selector), []),
    } as unknown as ParentNode
    initClips(root, {}, fakeEnv().env)
    expect(selectors).toEqual(['video[data-clip]'])
  })

  it('takes custom margins', () => {
    const fake = fakeEnv()
    initClips(
      rootOf([new FakeVideo([new FakeSource('/x.mp4')])]),
      { loadMargin: 100, threshold: 0.5 },
      fake.env,
    )
    expect(fake.observers.map((observer) => observer.options)).toEqual([
      { rootMargin: '100px 0px' },
      { threshold: 0.5 },
    ])
  })
})

describe('initClips with a pause', () => {
  type Listener = (event: { matches: boolean }) => void
  const stillSource = (initial: boolean) => {
    const listeners = new Set<Listener>()
    const query = {
      matches: initial,
      addEventListener: (_type: string, listener: unknown) => listeners.add(listener as Listener),
      removeEventListener: (_type: string, listener: unknown) =>
        listeners.delete(listener as Listener),
    }
    return {
      query: query as unknown as MediaQueryLike,
      listeners,
      set(matches: boolean) {
        query.matches = matches
        listeners.forEach((listener) => listener({ matches }))
      },
    }
  }

  it('holds still in place of the reduced-motion query when given one', () => {
    const still = stillSource(true)
    const fake = fakeEnv()
    const video = new FakeVideo()

    initClips(rootOf([video]), { still: still.query }, fake.env)

    expect(fake.observers).toEqual([])
    expect([video.loads, video.plays]).toEqual([0, 0])
    expect(fake.reducedListeners.size).toBe(0)
  })

  it('pauses every playing clip where it is, and plays the ones in view on resume', () => {
    const still = stillSource(false)
    const fake = fakeEnv()
    const videos = [new FakeVideo(), new FakeVideo()]
    const stop = initClips(rootOf(videos), { still: still.query }, fake.env)
    fake.observers[1]?.deliver({ target: videos[0], isIntersecting: true })
    expect(videos.map((video) => video.paused)).toEqual([false, true])

    still.set(true)
    expect(videos.map((video) => video.paused)).toEqual([true, true])
    expect(fake.observers.every((observer) => observer.disconnected)).toBe(true)
    still.set(false)
    fake.observers[3]?.deliver({ target: videos[0], isIntersecting: true })

    expect(videos.map((video) => video.paused)).toEqual([false, true])
    expect(videos[0]?.loads).toBe(1)
    stop()
    expect(still.listeners.size).toBe(0)
  })
})
