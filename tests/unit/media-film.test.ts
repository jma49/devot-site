import { describe, expect, it } from 'vitest'
import { SLOTS } from '../../src/media.ts'
import {
  cut,
  footageEntry,
  masterFile,
  masterNote,
  recordingArea,
  shotsToRecord,
  STILL,
  withEntry,
  type Master,
} from '../../scripts/media/device/film.ts'
import { FILM_SCENES, FILM_SHOTS } from '../../scripts/media/film-scenes.ts'
import { SCENES } from '../../scripts/media/scenes.ts'

// The film's whole-window masters: what is recorded, where it lands and how it is cut.

const window = { x: 216, y: 106, width: 1280, height: 800 }
const master: Master = {
  id: 'n1-write-mode',
  scheme: 'light',
  points: [1280, 800],
  pixels: [2560, 1600],
  fps: 30,
  start: 1.4,
  duration: 11.2,
  beats: [
    { t: 1, what: 'enter Write Mode' },
    { t: 3.4, what: 'type "hi"' },
  ],
}

describe('recordingArea', () => {
  it('is the scene frame inside the window for a clip', () => {
    const frame = { x: 262, y: 0, width: 656, height: 410 }
    expect(recordingArea(frame, window, false)).toEqual({ x: 478, y: 106, width: 656, height: 410 })
  })

  it('is the whole window for a master, whatever the clip shows', () => {
    const frame = { x: 262, y: 0, width: 656, height: 410 }
    expect(recordingArea(frame, window, true)).toEqual(window)
  })
})

describe('cut', () => {
  it('keeps a still moment before the script and after it', () => {
    const kept = cut(master)
    expect(kept.from).toBeCloseTo(1.4 - STILL)
    expect(kept.lead).toBeCloseTo(STILL)
    expect(kept.length).toBeCloseTo(11.2 + 2 * STILL)
  })

  it('starts at the recording when the script began sooner than a still moment', () => {
    const kept = cut({ start: 0.3, duration: 5 })
    expect(kept.from).toBe(0)
    expect(kept.lead).toBeCloseTo(0.3)
    expect(kept.length).toBeCloseTo(0.3 + 5 + STILL)
  })
})

describe('footageEntry', () => {
  it('records the packed file as measured, with the beats on its clock', () => {
    const entry = footageEntry(master, {
      file: 'mac/n1-write-mode-light.mp4',
      duration: 12.8004,
      source: 'demo build @ e2a39a3',
    })
    expect(entry).toEqual({
      id: 'n1-write-mode',
      file: 'mac/n1-write-mode-light.mp4',
      scheme: 'light',
      source: 'demo build @ e2a39a3',
      pixels: [2560, 1600],
      points: [1280, 800],
      fps: 30,
      duration: 12.8,
      cursor: true,
      beats: [
        { t: 1.8, what: 'enter Write Mode' },
        { t: 4.2, what: 'type "hi"' },
      ],
    })
  })
})

describe('withEntry', () => {
  it('replaces the record of the same file and keeps the rest, in file order', () => {
    const entries = [
      { file: 'mac/hero-light.mp4', duration: 1 },
      { file: 'iphone/p1-notes-light.mp4', duration: 2 },
    ]
    expect(withEntry(entries, { file: 'mac/hero-light.mp4', duration: 3 })).toEqual([
      { file: 'iphone/p1-notes-light.mp4', duration: 2 },
      { file: 'mac/hero-light.mp4', duration: 3 },
    ])
  })
})

describe('master files', () => {
  it('sit in the cache beside their notes, apart from the clips', () => {
    expect(masterFile('/c', 'hero', 'dark')).toBe('/c/film/hero-dark.mkv')
    expect(masterNote('/c', 'hero', 'dark')).toBe('/c/film/hero-dark.json')
  })
})

describe('the shot list', () => {
  it('has a scene for every shot and a shot for every scene', () => {
    expect(FILM_SHOTS.map((shot) => shot.id).sort()).toEqual(Object.keys(FILM_SCENES).sort())
    expect(new Set(FILM_SHOTS.map((shot) => shot.id)).size).toBe(FILM_SHOTS.length)
  })

  it("keeps the page's scenes as they are and adds the film's own beside them", () => {
    for (const slot of SLOTS) expect(FILM_SCENES[slot]).toBe(SCENES[slot])
    const added = Object.keys(FILM_SCENES).filter(
      (id) => !(SLOTS as readonly string[]).includes(id),
    )
    expect(added).toHaveLength(8)
    expect(added.every((id) => /^n\d-/.test(id))).toBe(true)
  })

  it("shows the whole window in each of the film's own scenes", () => {
    for (const [id, scene] of Object.entries(FILM_SCENES)) {
      if ((SLOTS as readonly string[]).includes(id)) continue
      expect(scene.slot).toBe(id)
      expect(scene.clip).toEqual({ x: 0, y: 0, ...scene.viewport })
      expect(scene.phone).toBeUndefined()
    }
  })

  it('records the hero in both schemes', () => {
    expect(FILM_SHOTS.find((shot) => shot.id === 'hero')?.schemes).toEqual(['light', 'dark'])
  })
})

describe('shotsToRecord', () => {
  const shots = [
    { id: 'hero', schemes: ['light', 'dark'] },
    { id: 'write', schemes: ['light'] },
  ] as const

  it('records every shot in its own schemes by default', () => {
    expect(shotsToRecord(shots, [])).toEqual([
      { id: 'hero', scheme: 'light' },
      { id: 'hero', scheme: 'dark' },
      { id: 'write', scheme: 'light' },
    ])
  })

  it('records the asked shots only, in the schemes the run names', () => {
    expect(shotsToRecord(shots, ['write'], ['dark'])).toEqual([{ id: 'write', scheme: 'dark' }])
  })

  it('refuses a shot it does not know', () => {
    expect(() => shotsToRecord(shots, ['nope'])).toThrow('E_MEDIA_ARGS no film shot nope')
  })
})
