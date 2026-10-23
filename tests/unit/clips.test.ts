import { describe, expect, it } from 'vitest'
import { initClips } from '../../src/scripts/clips.ts'
import { fakeEnv, FakeSource, FakeVideo, rootOf } from '../support/dom-fakes.ts'

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
