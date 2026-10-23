import { describe, expect, it } from 'vitest'
import { initPosters } from '../../src/scripts/posters.ts'
import { fakeEnv, rootOf } from '../support/dom-fakes.ts'

class FakePosterVideo {
  poster = ''
  readonly dataset: Record<string, string | undefined>

  constructor(poster: string) {
    this.dataset = { poster }
  }

  removeAttribute(name: string) {
    if (name === 'data-poster') delete this.dataset['poster']
  }
}

const setup = (options: { reduced?: boolean } = {}, videos = [new FakePosterVideo('/a.webp')]) => {
  const fake = fakeEnv(options)
  const stop = initPosters(rootOf(videos), {}, fake.env)
  return { ...fake, stop, videos, observer: fake.observers[0], video: videos[0] as FakePosterVideo }
}

describe('initPosters', () => {
  it('sets no poster until the clip is near, looking a screen ahead', () => {
    const { video, observer } = setup()

    expect([video.poster, video.dataset['poster']]).toEqual(['', '/a.webp'])
    expect(observer?.options).toEqual({ rootMargin: '600px 0px' })
    expect([...(observer?.observed ?? [])]).toEqual([video])
  })

  it('sets the poster once the clip comes near, and stops watching it', () => {
    const { video, observer } = setup()

    observer?.deliver({ target: video, isIntersecting: false })
    expect(video.poster).toBe('')
    observer?.deliver({ target: video, isIntersecting: true })

    expect([video.poster, video.dataset['poster']]).toEqual(['/a.webp', undefined])
    expect(observer?.observed.size).toBe(0)
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

  it('creates no observer when no clip waits for its poster, and disconnects when stopped', () => {
    expect(setup({}, []).observers).toEqual([])

    const { observer, stop } = setup()
    stop()

    expect(observer?.disconnected).toBe(true)
  })
})
