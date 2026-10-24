import { browserEnv, type DomEnv, type MediaQueryLike } from '../lib/dom-env.ts'

const controlled = new WeakSet<HTMLVideoElement>()

export interface ClipControls {
  /**
   * Gives `video`, which the browser refused to start, a play button until it plays; while the
   * clips hold still every clip has one already.
   */
  offer(video: HTMLVideoElement): void
  stop(): void
}

/**
 * Play buttons from `template[data-clip-control]`, named by each clip's `data-control-label` and
 * placed in its `[data-clip-dock]` or its parent. While `still` matches (the reader paused
 * animations) every `video[data-clip]` has one: a press plays the clip once through, in the files
 * for the scheme and width in use, one clip at a time and only while it is on screen and the tab is
 * shown. Otherwise only a clip passed to `offer` has one, which starts it looping as the others do.
 */
export function initClipControls(
  root: ParentNode,
  still: MediaQueryLike,
  env: DomEnv = browserEnv(),
): ClipControls {
  const template = root.querySelector<HTMLTemplateElement>('template[data-clip-control]')
  if (template === null) return { offer: () => {}, stop: () => {} }
  const offered = new Map<HTMLVideoElement, () => void>()
  let unmount: (() => void) | null = null

  const buttonFor = (video: HTMLVideoElement) => {
    const button = template.content.firstElementChild?.cloneNode(true)
    if (!(button instanceof HTMLButtonElement)) return null
    button.dataset['for'] = video.dataset['clip'] ?? ''
    const name = video.dataset['controlLabel']
    if (name) button.setAttribute('aria-label', name)
    const dock = video.closest<HTMLElement>('[data-clip-dock]') ?? video.parentElement
    dock?.append(button)
    return button
  }

  const withdraw = (video: HTMLVideoElement) => {
    offered.get(video)?.()
    offered.delete(video)
  }
  const withdrawAll = () => [...offered.keys()].forEach(withdraw)

  const offer = (video: HTMLVideoElement) => {
    if (unmount !== null || offered.has(video)) return
    const button = buttonFor(video)
    if (button === null) return
    // It only starts the clip and goes once the clip plays, so it is no toggle.
    button.removeAttribute('aria-pressed')
    const press = () => void Promise.resolve(video.play()).catch(() => {})
    const played = () => withdraw(video)
    button.addEventListener('click', press)
    video.addEventListener('playing', played)
    offered.set(video, () => {
      video.removeEventListener('playing', played)
      button.remove()
    })
  }

  const mount = () => {
    withdrawAll()
    const controls = new Map<HTMLVideoElement, HTMLButtonElement>()
    // The browser picks a source only on load(), so a clip loaded before the scheme or width
    // changed loads again before it plays.
    const stale = new WeakSet<HTMLVideoElement>()
    const variants = [
      ...new Set(
        [...root.querySelectorAll<HTMLSourceElement>('video[data-clip] source[media]')].map(
          ({ media }) => media,
        ),
      ),
    ].map((query) => env.matchMedia(query))
    let playing: HTMLVideoElement | null = null

    const stop = (video: HTMLVideoElement) => {
      video.pause()
      controls.get(video)?.setAttribute('aria-pressed', 'false')
      if (playing === video) playing = null
    }
    const play = (video: HTMLVideoElement) => {
      if (playing !== null && playing !== video) stop(playing)
      const sources = video.querySelectorAll<HTMLSourceElement>('source[data-src]')
      for (const source of sources) {
        source.src = source.dataset['src'] ?? ''
        source.removeAttribute('data-src')
      }
      if (stale.delete(video) || sources.length > 0) video.load()
      video.loop = false
      playing = video
      controls.get(video)?.setAttribute('aria-pressed', 'true')
      Promise.resolve(video.play()).catch(() => stop(video))
    }

    const observer = env.createObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) stop(target as HTMLVideoElement)
        }
      },
      { threshold: 0 },
    )
    const stopVisibility = env.onPageVisibility(() => {
      if (env.pageHidden() && playing !== null) stop(playing)
    })
    const onEnded = (event: Event) => stop(event.target as HTMLVideoElement)
    const onVariant = () => {
      for (const video of controls.keys()) stale.add(video)
      if (playing !== null) play(playing)
    }
    variants.forEach((query) => query.addEventListener('change', onVariant))

    for (const video of root.querySelectorAll<HTMLVideoElement>('video[data-clip]')) {
      if (controlled.has(video)) continue
      const button = buttonFor(video)
      if (button === null) continue
      controlled.add(video)
      button.addEventListener('click', () =>
        button.getAttribute('aria-pressed') === 'true' ? stop(video) : play(video),
      )
      controls.set(video, button)
      video.addEventListener('ended', onEnded)
      observer.observe(video)
    }

    return () => {
      observer.disconnect()
      stopVisibility()
      variants.forEach((query) => query.removeEventListener('change', onVariant))
      for (const [video, button] of controls) {
        stop(video)
        video.loop = true
        video.removeEventListener('ended', onEnded)
        button.remove()
        controlled.delete(video)
      }
    }
  }

  const sync = () => {
    if (still.matches && unmount === null) unmount = mount()
    if (!still.matches && unmount !== null) {
      unmount()
      unmount = null
    }
  }
  sync()
  still.addEventListener('change', sync)
  return {
    offer,
    stop: () => {
      still.removeEventListener('change', sync)
      unmount?.()
      unmount = null
      withdrawAll()
    },
  }
}
