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

export type Scheme = 'light' | 'dark'

export const SCHEMES: readonly Scheme[] = ['light', 'dark']

/** Phones get a closer cut of the window where a slot has one; a dark page gets the dark capture. */
export const PHONE_MEDIA = '(max-width: 639.98px)'
export const DARK_MEDIA = '(prefers-color-scheme: dark)'
export const LIGHT_MEDIA = '(prefers-color-scheme: light)'
const WIDE_MEDIA = '(min-width: 640px)'

export interface VariantKey {
  scheme: Scheme
  phone: boolean
}

export interface FileBytes {
  mp4: number
  webm: number
  poster: number
}

/** What `pnpm media:capture` measured for a slot, as src/media.json holds it. */
export interface Measured {
  /** Pixels of the encoded video and poster, twice the window points they show. */
  width: number
  height: number
  /** Window points across the clip: shown `w` pixels wide, the app is drawn at w / points px per pt. */
  points: number
  /** The smallest text in the clip, in points. */
  minText: number
  /** Seconds of one loop. */
  duration: number
  /** Seconds into the loop of the frame its poster shows. */
  posterTime: number
  edges: Edge[]
  /** The closer cut phones get, from the same recording. */
  phone?: { width: number; height: number; points: number; minText: number }
  /** Bytes of each file, by variant name. */
  bytes: Record<string, FileBytes>
}

export interface MediaVariant extends VariantKey {
  /** The media query it is for; none for the light desktop clip, which every other falls back to. */
  media?: string
  /** A query that matches where this variant applies and no other does, for a preload or a style. */
  only: string
  width: number
  height: number
  mp4: string
  webm: string
  poster: string
}

export interface MediaSlot extends Measured {
  name: SlotName
  alt: string
  /** The light desktop poster, the one without scripts or media queries. */
  poster: string
  /** False when the slot is a still: `Clip.astro` then renders the poster as an image. */
  clip: boolean
  /** Most specific first: phone dark, phone light, dark, light. */
  variants: MediaVariant[]
  /** For the `video`: the browser plays the first source whose media and type it accepts. */
  sources: { src: string; type: string; media?: string }[]
}

export const variantName = ({ scheme, phone }: VariantKey) => (phone ? `${scheme}-phone` : scheme)

/** Site paths of a variant's files; the same names sit under `public/`. */
export function slotPaths(
  name: SlotName,
  { scheme, phone }: VariantKey = { scheme: 'light', phone: false },
): { mp4: string; webm: string; poster: string } {
  const base = `/media/${name}/${name}${phone ? '-phone' : ''}${scheme === 'dark' ? '-dark' : ''}`
  return { mp4: `${base}.mp4`, webm: `${base}.webm`, poster: `${base}-poster.webp` }
}

// Largest picture of each AV1 level (spec annex A.3), with its seq_level_idx.
const AV1_LEVELS: [number, number][] = [
  [147_456, 0],
  [278_784, 1],
  [665_856, 4],
  [1_065_024, 5],
  [2_359_296, 8],
  [8_912_896, 12],
  [35_651_584, 16],
]

/** The `codecs` value of an 8-bit main-profile AV1 stream of this size, for a source's `type`. */
export function av1Codecs(width: number, height: number): string {
  const level = AV1_LEVELS.find(([most]) => width * height <= most)?.[1] ?? 31
  return `av01.0.${String(level).padStart(2, '0')}M.08`
}

function variantsOf(name: SlotName, entry: Measured): MediaVariant[] {
  const keys: (VariantKey & { media?: string })[] = [
    ...(entry.phone
      ? [
          { scheme: 'dark' as const, phone: true, media: `${PHONE_MEDIA} and ${DARK_MEDIA}` },
          { scheme: 'light' as const, phone: true, media: `${PHONE_MEDIA} and ${LIGHT_MEDIA}` },
        ]
      : []),
    { scheme: 'dark', phone: false, media: DARK_MEDIA },
    { scheme: 'light', phone: false },
  ]
  return keys.map(({ scheme, phone, media }) => {
    const size = phone && entry.phone ? entry.phone : entry
    const colour = scheme === 'dark' ? DARK_MEDIA : LIGHT_MEDIA
    const width = entry.phone ? `${phone ? PHONE_MEDIA : WIDE_MEDIA} and ` : ''
    return {
      scheme,
      phone,
      ...(media ? { media } : {}),
      only: `${width}${colour}`,
      width: size.width,
      height: size.height,
      ...slotPaths(name, { scheme, phone }),
    }
  })
}

function slot(name: SlotName): MediaSlot {
  const entry = (measured as Record<SlotName, Measured>)[name]
  const variants = variantsOf(name, entry)
  return {
    ...entry,
    name,
    alt: en.media[name],
    poster: slotPaths(name).poster,
    clip: true,
    variants,
    sources: variants.flatMap(({ webm, mp4, width, height, media }) => [
      { src: webm, type: `video/webm; codecs="${av1Codecs(width, height)}"`, media },
      { src: mp4, type: 'video/mp4', media },
    ]),
  }
}

export const media: Record<SlotName, MediaSlot> = Object.fromEntries(
  SLOTS.map((name) => [name, slot(name)]),
) as Record<SlotName, MediaSlot>
