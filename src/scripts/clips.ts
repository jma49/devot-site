import { browserEnv, REDUCED_MOTION_QUERY, type DomEnv, type ObserverLike } from '../lib/dom-env.ts'

export interface ClipOptions {
  /** Pixels outside the viewport at which a clip starts loading its sources. */
  loadMargin?: number
  /** Share of a clip that must be visible for it to play; 0 is any part of it. */
  threshold?: number
}

/**
 * Plays each `video[data-clip]` only while it is in view and the tab is visible, and pauses it
 * otherwise. Its `<source data-src>` files are not requested until the clip is near the viewport.
 * With reduced motion nothing loads or plays, so the poster stays. Returns a function that stops
 * it all.
 */
export function initClips(
  root: ParentNode = document,
  options: ClipOptions = {},
  env: DomEnv = browserEnv(),
): () => void {
  const { loadMargin = 600, threshold = 0 } = options
  const videos = [...root.querySelectorAll<HTMLVideoElement>('video[data-clip]')]
  const inView = new Set<HTMLVideoElement>()
  const loaded = new WeakSet<HTMLVideoElement>()
  const reduced = env.matchMedia(REDUCED_MOTION_QUERY)
  let observers: ObserverLike[] = []

  const load = (video: HTMLVideoElement) => {
    if (loaded.has(video)) return
    loaded.add(video)
    for (const source of video.querySelectorAll<HTMLSourceElement>('source[data-src]')) {
      source.src = source.dataset['src'] ?? ''
      source.removeAttribute('data-src')
    }
    video.preload = 'auto'
    video.load()
  }

  const sync = (video: HTMLVideoElement) => {
    if (!inView.has(video) || env.pageHidden()) return video.pause()
    load(video)
    // A refused play() leaves the poster showing; there is nothing to report.
    Promise.resolve(video.play()).catch(() => {})
  }

  const start = () => {
    const warm = env.createObserver(
      (entries) => {
        for (const entry of entries.filter(({ isIntersecting }) => isIntersecting)) {
          load(entry.target as HTMLVideoElement)
          warm.unobserve(entry.target)
        }
      },
      { rootMargin: `${loadMargin}px 0px` },
    )
    const watch = env.createObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          const video = target as HTMLVideoElement
          if (isIntersecting) inView.add(video)
          else inView.delete(video)
          sync(video)
        }
      },
      { threshold },
    )
    observers = [warm, watch]
    for (const video of videos) {
      warm.observe(video)
      watch.observe(video)
    }
  }

  const stop = () => {
    observers.forEach((observer) => observer.disconnect())
    observers = []
    inView.clear()
    videos.forEach((video) => video.pause())
  }

  const onReducedMotion = (event: { matches: boolean }) => (event.matches ? stop() : start())
  const stopVisibility = env.onPageVisibility(() => inView.forEach(sync))

  if (!reduced.matches) start()
  reduced.addEventListener('change', onReducedMotion)
  return () => {
    stop()
    stopVisibility()
    reduced.removeEventListener('change', onReducedMotion)
  }
}
