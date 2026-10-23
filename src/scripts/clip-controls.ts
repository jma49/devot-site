import {
  browserEnv,
  REDUCED_MOTION_QUERY,
  type DomEnv,
  type MediaQueryLike,
} from '../lib/dom-env.ts'

const controlled = new WeakSet<HTMLVideoElement>()

/**
 * While the clips hold still (src/scripts/clips.ts), this gives each `video[data-clip]` a play
 * button from `template[data-clip-control]`, placed in the clip's `[data-clip-dock]` or its parent.
 * A press plays the clip once through. One clip plays at a time, and only while it is on screen and
 * the tab is shown. `still` says when: by default, while reduced motion is on.
 */
export function initClipControls(
  root: ParentNode = document,
  env: DomEnv = browserEnv(),
  still: MediaQueryLike = env.matchMedia(REDUCED_MOTION_QUERY),
): () => void {
  const template = root.querySelector<HTMLTemplateElement>('template[data-clip-control]')
  if (template === null) return () => {}
  let unmount: (() => void) | null = null

  const mount = () => {
    const controls = new Map<HTMLVideoElement, HTMLButtonElement>()
    let playing: HTMLVideoElement | null = null

    const stop = (video: HTMLVideoElement) => {
      video.pause()
      controls.get(video)?.setAttribute('aria-pressed', 'false')
      if (playing === video) playing = null
    }
    const play = (video: HTMLVideoElement) => {
      if (playing !== null && playing !== video) stop(playing)
      const sources = video.querySelectorAll<HTMLSourceElement>('source[data-src]')
      if (sources.length > 0) {
        for (const source of sources) {
          source.src = source.dataset['src'] ?? ''
          source.removeAttribute('data-src')
        }
        video.load()
      }
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

    for (const video of root.querySelectorAll<HTMLVideoElement>('video[data-clip]')) {
      if (controlled.has(video)) continue
      controlled.add(video)
      const button = template.content.firstElementChild?.cloneNode(true)
      if (!(button instanceof HTMLButtonElement)) continue
      button.dataset['for'] = video.dataset['clip'] ?? ''
      button.addEventListener('click', () =>
        button.getAttribute('aria-pressed') === 'true' ? stop(video) : play(video),
      )
      const dock = video.closest<HTMLElement>('[data-clip-dock]') ?? video.parentElement
      dock?.append(button)
      controls.set(video, button)
      video.addEventListener('ended', onEnded)
      observer.observe(video)
    }

    return () => {
      observer.disconnect()
      stopVisibility()
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
  return () => {
    still.removeEventListener('change', sync)
    unmount?.()
    unmount = null
  }
}
