import { join } from 'node:path'
import type { Scheme } from '../../../src/media.ts'
import type { Rect } from '../frames.ts'
import type { Beat } from '../timeline.ts'

// The film's masters: with MEDIA_FULL_WINDOW=1 `pnpm media:device` records the whole window of a
// scene, lossless, to .cache/media/film/ with a note of where the script starts, and leaves the
// page's clips alone. `pnpm media:film:pack` cuts each to its script and writes footage/.

/** Still seconds kept before the script's first step and after its last. */
export const STILL = 0.8

export interface Master {
  id: string
  scheme: Scheme
  /** The window in points and the recording in pixels. */
  points: [number, number]
  pixels: [number, number]
  fps: number
  /** Seconds into the recording at which the script began. */
  start: number
  /** The script's length in seconds. */
  duration: number
  beats: Beat[]
}

export const filmDir = (cache: string) => join(cache, 'film')
export const masterFile = (cache: string, id: string, scheme: Scheme) =>
  join(filmDir(cache), `${id}-${scheme}.mkv`)
export const masterNote = (cache: string, id: string, scheme: Scheme) =>
  join(filmDir(cache), `${id}-${scheme}.json`)

/** The part of the screen to record, in points: the scene's frame, or the whole window. */
export function recordingArea(frame: Rect, window: Rect, fullWindow: boolean): Rect {
  if (fullWindow) return { ...window }
  return { ...frame, x: window.x + frame.x, y: window.y + frame.y }
}

/** The stretch of a master to keep: its script with a still moment on either side. */
export function cut(
  master: Pick<Master, 'start' | 'duration'>,
  still = STILL,
): { from: number; length: number; lead: number } {
  const from = Math.max(0, master.start - still)
  const lead = master.start - from
  return { from, length: lead + master.duration + still, lead }
}

export interface FootageEntry {
  id: string
  file: string
  scheme: Scheme
  source: string
  pixels: [number, number]
  points: [number, number]
  fps: number
  duration: number
  cursor: boolean
  beats: Beat[]
}

const round = (n: number) => Math.round(n * 100) / 100

/** A master's record in footage/manifest.json; `duration` is the packed file's, as measured. */
export function footageEntry(
  master: Master,
  packed: { file: string; duration: number; source: string },
): FootageEntry {
  const { lead } = cut(master)
  return {
    id: master.id,
    file: packed.file,
    scheme: master.scheme,
    source: packed.source,
    pixels: master.pixels,
    points: master.points,
    fps: master.fps,
    duration: round(packed.duration),
    cursor: true,
    beats: master.beats.map((beat) => ({ t: round(beat.t + lead), what: beat.what })),
  }
}

/** The entries of a manifest with `entry` in place of any other record of the same file. */
export function withEntry<T extends { file: string }>(entries: readonly T[], entry: T): T[] {
  return [...entries.filter((e) => e.file !== entry.file), entry].sort((a, b) =>
    a.file.localeCompare(b.file),
  )
}

/**
 * The masters a run records: the asked shots, or every shot, each in its own schemes unless the
 * run names some.
 */
export function shotsToRecord(
  shots: readonly { id: string; schemes: readonly Scheme[] }[],
  ids: readonly string[],
  schemes?: readonly Scheme[],
): { id: string; scheme: Scheme }[] {
  const unknown = ids.filter((id) => !shots.some((shot) => shot.id === id))
  if (unknown.length > 0) {
    throw new Error(`E_MEDIA_ARGS no film shot ${unknown.join(' ')}`)
  }
  return shots
    .filter((shot) => ids.length === 0 || ids.includes(shot.id))
    .flatMap((shot) => (schemes ?? shot.schemes).map((scheme) => ({ id: shot.id, scheme })))
}
