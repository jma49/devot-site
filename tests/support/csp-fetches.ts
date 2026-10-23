import { tags, type Tag } from './html.ts'

/** A URL the browser fetches for a page, and the CSP directive that governs it. */
export type Fetch = { directive: string; url: string }

const MEDIA = /<(video|audio)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi

const PRELOAD: Record<string, string> = {
  style: 'style-src',
  font: 'font-src',
  image: 'img-src',
  fetch: 'connect-src',
  script: 'script-src',
  audio: 'media-src',
  video: 'media-src',
  track: 'media-src',
}

/**
 * What the markup of a built page makes the browser fetch. A preload whose `as` has no known
 * directive maps to `unknown`, so a check fails instead of guessing.
 */
export function fetches(html: string): Fetch[] {
  const media: Fetch[] = []
  const rest = html.replace(MEDIA, (block, name: string, attrs: string, inner: string) => {
    const [element] = tags(`<${name}${attrs}>`)
    const src = element?.attrs.get('src')
    const poster = element?.attrs.get('poster')
    if (src) media.push({ directive: 'media-src', url: src })
    if (poster) media.push({ directive: 'img-src', url: poster })
    for (const child of tags(inner)) {
      const url = child.attrs.get('src')
      if ((child.name === 'source' || child.name === 'track') && url)
        media.push({ directive: 'media-src', url })
    }
    return ' '.repeat(block.length)
  })
  return [...media, ...tags(rest).flatMap(fetchesOf)]
}

function fetchesOf({ name, attrs }: Tag): Fetch[] {
  const get = (attr: string) => attrs.get(attr) ?? ''
  const as = (directive: string, ...urls: string[]) =>
    urls.filter(Boolean).map((url) => ({ directive, url }))
  const rel = get('rel').toLowerCase().split(/\s+/)

  switch (name) {
    case 'script':
      return as('script-src', get('src'))
    case 'img':
    case 'source':
      return as('img-src', get('src'), ...candidates(get('srcset')))
    case 'iframe':
      return as('frame-src', get('src'))
    case 'object':
      return as('object-src', get('data'))
    case 'embed':
      return as('object-src', get('src'))
    case 'link':
      if (rel.includes('stylesheet')) return as('style-src', get('href'))
      if (rel.some((r) => r.endsWith('icon'))) return as('img-src', get('href'))
      if (rel.includes('manifest')) return as('manifest-src', get('href'))
      if (rel.includes('modulepreload')) return as('script-src', get('href'))
      if (rel.includes('preload'))
        return as(PRELOAD[get('as').toLowerCase()] ?? 'unknown', get('href'))
      return []
    default:
      return []
  }
}

function candidates(srcset: string): string[] {
  return srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
}
