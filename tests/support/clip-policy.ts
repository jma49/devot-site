import { tags } from './html.ts'
import { videoProblems } from './video-policy.ts'

const VIDEO = /<video\b([^>]*)>([\s\S]*?)<\/video\s*>/gi

export interface BuiltClip {
  /** The poster without scripts or media queries. */
  poster?: string
  /** Every poster a media query can pick, from `data-poster-media`. */
  posters: string[]
  /** The files the clip loads once it is near the viewport. */
  sources: string[]
  problems: string[]
}

const ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', '#39': "'" }
const decode = (text: string) =>
  text.replace(/&(quot|amp|lt|gt|#39);/g, (_, name: string) => ENTITIES[name]!)

function posterVariants(json: string | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(decode(json ?? '[]'))
    return Array.isArray(parsed) ? parsed.map((pair) => String((pair as unknown[])[1])) : []
  } catch {
    return ['(data-poster-media is not JSON)']
  }
}

/**
 * The `video[data-clip]` elements of a built page: their files, and what keeps them from loading
 * only when needed and only for the reader's scheme (an early `src` or `poster`, a `preload` other
 * than none, no `data-src` source).
 */
export function builtClips(html: string): BuiltClip[] {
  return [...html.matchAll(VIDEO)].flatMap(([, rest = '', inner = '']) => {
    const [video] = tags(`<video${rest}>`)
    if (!video?.attrs.has('data-clip')) return []
    const children = tags(inner, 'source')
    const sources = children.flatMap(({ attrs }) => attrs.get('data-src') ?? [])
    const problems = [
      ...videoProblems(`<video${rest}></video>`),
      ...(video.attrs.has('src') || children.some(({ attrs }) => attrs.has('src'))
        ? ['has a src, so the clip loads at once']
        : []),
      ...(video.attrs.has('poster') ? ['has a poster, so it loads at once in every scheme'] : []),
      ...(video.attrs.get('preload') === 'none' ? [] : ['lacks preload="none"']),
      ...(sources.length === 0 ? ['has no source with data-src'] : []),
    ]
    const poster = video.attrs.get('data-poster')
    return [
      { poster, posters: posterVariants(video.attrs.get('data-poster-media')), sources, problems },
    ]
  })
}
