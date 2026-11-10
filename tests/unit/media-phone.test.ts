import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PHONE_SHOTS,
  phoneCut,
  phoneEntry,
  phoneSettings,
  phoneShotsToRecord,
  type ShotNote,
} from '../../scripts/media/phone/shots.ts'

// The film's iPhone shots: which tests of FilmShots.swift are recorded, and how a recording is cut.

const swift = readFileSync(
  join(import.meta.dirname, '../../scripts/media/phone/FilmShots.swift'),
  'utf8',
)
const note: ShotNote = {
  id: 'p2-read',
  scheme: 'dark',
  start: 1_700_000_012.4,
  end: 1_700_000_022.9,
  points: [402, 874],
  beats: [
    { t: 1.004, what: 'open Spring launch plan', x: 201, y: 240 },
    { t: 3.5, what: 'scroll past the goals' },
  ],
}

describe('the shot list', () => {
  it('names a test of FilmShots.swift for every shot, and the id that test starts', () => {
    for (const shot of PHONE_SHOTS) {
      expect(swift, shot.id).toContain(`func ${shot.test}() throws`)
      expect(swift, shot.id).toContain(`start("${shot.id}")`)
    }
  })

  it('records the list and a note in both schemes', () => {
    const both = PHONE_SHOTS.filter((shot) => shot.schemes.length === 2).map((shot) => shot.id)
    expect(both).toEqual(['p1-notes', 'p2-read'])
  })
})

describe('phoneShotsToRecord', () => {
  it('records every shot in its own schemes by default', () => {
    const all = phoneShotsToRecord([])
    expect(all).toHaveLength(10)
    expect(all.slice(0, 2).map(({ shot, scheme }) => `${shot.id} ${scheme}`)).toEqual([
      'p1-notes light',
      'p1-notes dark',
    ])
  })

  it('records the asked shots in the schemes the run names', () => {
    expect(
      phoneShotsToRecord(['p4-search'], ['dark']).map(({ shot, scheme }) => `${shot.id} ${scheme}`),
    ).toEqual(['p4-search dark'])
  })

  it('refuses a shot it does not know', () => {
    expect(() => phoneShotsToRecord(['p9'])).toThrow('E_PHONE_ARGS no phone shot p9')
  })
})

describe('phoneCut', () => {
  it('keeps the recording from the shot start to its end', () => {
    const cut = phoneCut(note, 1_700_000_004.4)
    expect(cut.from).toBeCloseTo(8)
    expect(cut.length).toBeCloseTo(10.5)
  })

  it('refuses a recording that began after the shot', () => {
    expect(() => phoneCut(note, 1_700_000_013)).toThrow('E_PHONE_LATE_RECORDING')
  })
})

describe('phoneEntry', () => {
  it('records the file as measured, without a pointer, the touches in points', () => {
    expect(
      phoneEntry(note, {
        file: 'iphone/p2-read-dark.mp4',
        duration: 10.5167,
        pixels: [1206, 2622],
        fps: 60,
        source: 'iOS Simulator (iPhone 17, iOS 26.2), debug build @ e2a39a3',
      }),
    ).toEqual({
      id: 'p2-read',
      file: 'iphone/p2-read-dark.mp4',
      scheme: 'dark',
      source: 'iOS Simulator (iPhone 17, iOS 26.2), debug build @ e2a39a3',
      pixels: [1206, 2622],
      points: [402, 874],
      fps: 60,
      duration: 10.52,
      cursor: false,
      beats: [
        { t: 1, what: 'open Spring launch plan', x: 201, y: 240 },
        { t: 3.5, what: 'scroll past the goals' },
      ],
    })
  })
})

describe('phoneSettings', () => {
  it('starts a shot in Tide in the asked scheme, the gradient as the app leaves it unless set', () => {
    expect(phoneSettings('dark')).toEqual({
      appearance: 'dark',
      lightTheme: 'tide',
      darkTheme: 'tide',
    })
    expect(phoneSettings('light', 100)).toMatchObject({ gradientStrength: 100 })
  })
})
