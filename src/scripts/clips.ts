import { browserEnv, type DomEnv, type MediaQueryLike, type ObserverLike } from '../lib/dom-env.ts'

export interface ClipOptions {
  /** Pixels outside the viewport at which a clip starts loading its sources. */
  loadMargin?: number
  /** Share of a clip that must be visible for it to play; 0 is any part of it. */
  threshold?: number
  /** Matches while every clip holds still (the reader paused animations); by default never. */
  still?: MediaQueryLike
  /** Hears of a clip in view that the browser refused to start without a press of its own. */
  onRefused?: (video: HTMLVideoElement) => void
}

const NEVER: MediaQueryLike = {
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}

const refusedByBrowser = (error: unknown) =>
  (error as { name?: unknown } | null)?.name === 'NotAllowedError'

/**
 * Plays each `video[data-clip]` on a loop while it is in view and the tab is visible, and pauses
 * it otherwise, with reduced motion too: the clips are calm screen recordings, and the reader's
 * pause stops them. Its `<source data-src>` files are not requested until the clip is near the
 * viewport, and the browser then picks the one whose `media` matches (scheme, width); when that
 * changes, a loaded clip loads again so it follows. While `still` matches nothing loads or plays: a
 * playing clip stops on its frame, the others keep their posters. Returns a function that stops it
 * all.
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
  const still = options.still ?? NEVER
  const variants = [
    ...new Set(
      videos.flatMap((video) =>
        [...video.querySelectorAll<HTMLSourceElement>('source')].map((source) => source.media),
      ),
    ),
  ]
    .filter(Boolean)
    .map((media) => env.matchMedia(media))
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
    // Any other refusal (a pause() or load() before playback began) leaves the poster showing.
    Promise.resolve(video.play()).catch((error: unknown) => {
      if (refusedByBrowser(error) && inView.has(video)) options.onRefused?.(video)
    })
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

  const onStill = (event: { matches: boolean }) => (event.matches ? stop() : start())
  const stopVisibility = env.onPageVisibility(() => inView.forEach(sync))
  const reload = () => {
    for (const video of videos.filter((each) => loaded.has(each))) {
      video.load()
      sync(video)
    }
  }

  if (!still.matches) start()
  still.addEventListener('change', onStill)
  variants.forEach((query) => query.addEventListener('change', reload))
  return () => {
    stop()
    stopVisibility()
    still.removeEventListener('change', onStill)
    variants.forEach((query) => query.removeEventListener('change', reload))
  }
}
