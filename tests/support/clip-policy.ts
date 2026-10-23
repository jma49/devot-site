import { tags } from './html.ts'
import { videoProblems } from './video-policy.ts'

const VIDEO = /<video\b([^>]*)>([\s\S]*?)<\/video\s*>/gi

export interface BuiltClip {
  poster?: string
  /** The files the clip loads once it is near the viewport. */
  sources: string[]
  problems: string[]
}

/**
 * The `video[data-clip]` elements of a built page: their files, and what keeps them from loading
 * only when needed (an early `src`, a `preload` other than none, no `data-src` source).
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
      ...(video.attrs.get('preload') === 'none' ? [] : ['lacks preload="none"']),
      ...(sources.length === 0 ? ['has no source with data-src'] : []),
    ]
    const poster = video.attrs.get('poster') ?? video.attrs.get('data-poster')
    return [{ poster, sources, problems }]
  })
}
