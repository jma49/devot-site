import type { Scheme } from '../../../src/media.ts'
import type { Beat } from '../timeline.ts'

// The film's iPhone shots: Devot's iPhone app in the iOS Simulator, each shot one test of
// FilmShots.swift, recorded with `simctl io recordVideo` and cut to the test's own start and end.

export interface PhoneShot {
  id: string
  /** The test method of FilmShots.swift that plays it. */
  test: string
  schemes: readonly Scheme[]
}

const BOTH: readonly Scheme[] = ['light', 'dark']
const LIGHT: readonly Scheme[] = ['light']

export const PHONE_SHOTS: readonly PhoneShot[] = [
  { id: 'p1-notes', test: 'testP1Notes', schemes: BOTH },
  { id: 'p2-read', test: 'testP2Read', schemes: BOTH },
  { id: 'p3-edit', test: 'testP3Edit', schemes: LIGHT },
  { id: 'p4-search', test: 'testP4Search', schemes: LIGHT },
  { id: 'p5-library', test: 'testP5Library', schemes: LIGHT },
  { id: 'p6-activity', test: 'testP6Activity', schemes: LIGHT },
  { id: 'p7-new-note', test: 'testP7NewNote', schemes: LIGHT },
  { id: 'p8-settings', test: 'testP8Settings', schemes: LIGHT },
]

/** What a test of FilmShots.swift leaves beside its still: `<id>-<scheme>.json`. */
export interface ShotNote {
  id: string
  scheme: Scheme
  /** Unix seconds at which the shot began and ended. */
  start: number
  end: number
  /** The screen in points. */
  points: [number, number]
  /** `x` and `y` are where a step touches the screen, in points. */
  beats: (Beat & { x?: number; y?: number })[]
}

/**
 * The stretch of a recording that began at `recordingStart` (Unix seconds) to keep for a shot. A
 * test rests about a second after its start and before its end, so the cut needs no margin.
 */
export function phoneCut(
  note: Pick<ShotNote, 'start' | 'end'>,
  recordingStart: number,
): { from: number; length: number } {
  const from = note.start - recordingStart
  if (from < 0) {
    throw new Error(`E_PHONE_LATE_RECORDING the shot began ${(-from).toFixed(2)} s before it`)
  }
  return { from, length: note.end - note.start }
}

export interface PhoneEntry {
  id: string
  file: string
  scheme: Scheme
  source: string
  pixels: [number, number]
  points: [number, number]
  fps: number
  duration: number
  cursor: false
  beats: ShotNote['beats']
}

const round = (n: number) => Math.round(n * 100) / 100

/** A shot's record in footage/manifest.json; `duration` and `pixels` are the file's, as measured. */
export function phoneEntry(
  note: ShotNote,
  packed: { file: string; duration: number; pixels: [number, number]; fps: number; source: string },
): PhoneEntry {
  return {
    id: note.id,
    file: packed.file,
    scheme: note.scheme,
    source: packed.source,
    pixels: packed.pixels,
    points: note.points,
    fps: packed.fps,
    duration: round(packed.duration),
    cursor: false,
    beats: note.beats.map((beat) => ({ ...beat, t: round(beat.t) })),
  }
}

/** The shots a run records: the asked ones, or all, each in its own schemes unless the run names some. */
export function phoneShotsToRecord(
  ids: readonly string[],
  schemes?: readonly Scheme[],
): { shot: PhoneShot; scheme: Scheme }[] {
  const unknown = ids.filter((id) => !PHONE_SHOTS.some((shot) => shot.id === id))
  if (unknown.length > 0) throw new Error(`E_PHONE_ARGS no phone shot ${unknown.join(' ')}`)
  return PHONE_SHOTS.filter((shot) => ids.length === 0 || ids.includes(shot.id)).flatMap((shot) =>
    (schemes ?? shot.schemes).map((scheme) => ({ shot, scheme })),
  )
}

/** The editor settings a phone shot starts from: Tide in the asked scheme. */
export function phoneSettings(scheme: Scheme, gradient?: number): Record<string, unknown> {
  return {
    appearance: scheme,
    lightTheme: 'tide',
    darkTheme: 'tide',
    ...(gradient !== undefined && { gradientStrength: gradient }),
  }
}
