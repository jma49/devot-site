import { en } from './i18n/en.ts'
import measured from './media.json' with { type: 'json' }

export const SLOTS = [
  'hero',
  'write',
  'organise',
  'find',
  'card-1',
  'card-2',
  'card-3',
  'card-4',
  'card-5',
  'card-6',
] as const

export type SlotName = (typeof SLOTS)[number]

/** A side of the Devot window. */
export type Edge = 'top' | 'right' | 'bottom' | 'left'

export interface MediaSlot {
  name: SlotName
  /** Pixels of the encoded video and poster, about twice the size they are shown at. */
  width: number
  height: number
  /** Seconds of one loop. */
  duration: number
  /** The window's own edges the clip shows, to round and outline; its other sides are cuts to fade out. */
  edges: Edge[]
  alt: string
  poster: string
  /** False when the slot is a still: `Clip.astro` then renders the poster as an image. */
  clip: boolean
  /** Preferred first: the browser plays the first source it supports. */
  sources: { src: string; type: string }[]
}

/** Site paths of a slot's files; the same names sit under `public/`. */
export function slotPaths(name: SlotName): { mp4: string; webm: string; poster: string } {
  const base = `/media/${name}/${name}`
  return { mp4: `${base}.mp4`, webm: `${base}.webm`, poster: `${base}-poster.webp` }
}

function slot(name: SlotName): MediaSlot {
  const paths = slotPaths(name)
  const { width, height, duration, edges } = (
    measured as Record<
      SlotName,
      { width: number; height: number; duration: number; edges: string[] }
    >
  )[name]
  return {
    name,
    width,
    height,
    duration,
    edges: edges as Edge[],
    alt: en.media[name],
    poster: paths.poster,
    clip: true,
    sources: [
      { src: paths.mp4, type: 'video/mp4' },
      { src: paths.webm, type: 'video/webm' },
    ],
  }
}

// Sizes, loop lengths and window edges are measured by `pnpm media:capture` (scripts/media), which
// writes them to media.json.
export const media: Record<SlotName, MediaSlot> = Object.fromEntries(
  SLOTS.map((name) => [name, slot(name)]),
) as Record<SlotName, MediaSlot>
