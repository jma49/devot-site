import { en } from './i18n/en.ts'

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

export interface MediaSlot {
  name: SlotName
  /** Pixels of the encoded video and poster: 2x of the size they are shown at. */
  width: number
  height: number
  /** Seconds of one loop. */
  duration: number
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

function slot(name: SlotName, width: number, height: number, duration: number): MediaSlot {
  const paths = slotPaths(name)
  return {
    name,
    width,
    height,
    duration,
    alt: en.media[name],
    poster: paths.poster,
    clip: true,
    sources: [
      { src: paths.mp4, type: 'video/mp4' },
      { src: paths.webm, type: 'video/webm' },
    ],
  }
}

// Sizes and durations are those of the placeholders; capture replaces them with measured values.
// Cards: wide is 6 of 10 grid columns, narrow is 4.
export const media: Record<SlotName, MediaSlot> = {
  hero: slot('hero', 1500, 1080, 2),
  write: slot('write', 1500, 1080, 2),
  organise: slot('organise', 1500, 1080, 2),
  find: slot('find', 1500, 1080, 2),
  'card-1': slot('card-1', 1720, 1080, 2),
  'card-2': slot('card-2', 860, 1080, 2),
  'card-3': slot('card-3', 860, 1080, 2),
  'card-4': slot('card-4', 1720, 1080, 2),
  'card-5': slot('card-5', 1720, 1080, 2),
  'card-6': slot('card-6', 860, 1080, 2),
}
