import { browserEnv, type DomEnv, type MediaQueryLike } from '../lib/dom-env.ts'

export interface PosterOptions {
  /** Pixels outside the viewport at which a clip gets its poster. */
  margin?: number
}

/** `data-poster-media`: [media query, poster] pairs, most specific first, as Clip.astro writes them. */
function variantsOf(video: HTMLVideoElement): [string, string][] {
  try {
    const parsed: unknown = JSON.parse(video.dataset['posterMedia'] ?? '[]')
    return Array.isArray(parsed) ? (parsed as [string, string][]) : []
  } catch {
    return []
  }
}

/**
 * Gives each `video[data-poster]` its poster once it comes near the viewport: the first of its
 * `data-poster-media` variants whose media query matches (the dark capture on a dark page, a closer
 * cut on a phone), or `data-poster`. A browser fetches a poster as soon as the attribute is set, so
 * clips carry them as data until then, and only the matching file is ever requested. A shown
 * poster follows a change of scheme.
 */
export function initPosters(
  root: ParentNode = document,
  options: PosterOptions = {},
  env: DomEnv = browserEnv(),
): () => void {
  const { margin = 600 } = options
  const videos = [...root.querySelectorAll<HTMLVideoElement>('video[data-poster]')]
  if (videos.length === 0) return () => {}
  const shown = new Set<HTMLVideoElement>()
  const queries = new Map<string, MediaQueryLike>()
  const query = (media: string) => {
    let list = queries.get(media)
    if (!list) {
      list = env.matchMedia(media)
      queries.set(media, list)
    }
    return list
  }

  const show = (video: HTMLVideoElement) => {
    const poster =
      variantsOf(video).find(([media]) => query(media).matches)?.[1] ?? video.dataset['poster']
    if (poster && video.getAttribute('poster') !== poster) video.poster = poster
  }

  const observer = env.createObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue
        const video = target as HTMLVideoElement
        shown.add(video)
        show(video)
        observer.unobserve(video)
      }
    },
    { rootMargin: `${margin}px 0px` },
  )
  videos.forEach((video) => observer.observe(video))

  const refresh = () => shown.forEach(show)
  for (const media of new Set(videos.flatMap((video) => variantsOf(video).map(([m]) => m)))) {
    query(media).addEventListener('change', refresh)
  }
  return () => {
    observer.disconnect()
    queries.forEach((list) => list.removeEventListener('change', refresh))
  }
}
