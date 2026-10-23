import { browserEnv, type DomEnv } from '../lib/dom-env.ts'

export interface PosterOptions {
  /** Pixels outside the viewport at which a clip gets its poster. */
  margin?: number
}

/**
 * Gives each `video[data-poster]` its poster once it comes near the viewport. A browser fetches a
 * poster as soon as the attribute is set, so clips below the first screen carry it as
 * `data-poster` until then; with reduced motion too, where the poster stands in for the clip.
 */
export function initPosters(
  root: ParentNode = document,
  options: PosterOptions = {},
  env: DomEnv = browserEnv(),
): () => void {
  const { margin = 600 } = options
  const videos = [...root.querySelectorAll<HTMLVideoElement>('video[data-poster]')]
  if (videos.length === 0) return () => {}

  const observer = env.createObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue
        const video = target as HTMLVideoElement
        video.poster = video.dataset['poster'] ?? ''
        video.removeAttribute('data-poster')
        observer.unobserve(video)
      }
    },
    { rootMargin: `${margin}px 0px` },
  )
  videos.forEach((video) => observer.observe(video))
  return () => observer.disconnect()
}
