import { describe, expect, it } from 'vitest'
import {
  CursorScript,
  glide,
  random,
  typingTimes,
  type Actions,
  type Point,
} from '../../scripts/media/timeline.ts'

const recorder = () => {
  const log: string[] = []
  const actions: Actions = {
    down: async () => void log.push('down'),
    up: async () => void log.push('up'),
    type: async (text) => void log.push(`type ${text}`),
    press: async (key) => void log.push(`press ${key}`),
  }
  return { log, actions }
}

async function runAll(events: { at: number; run: () => Promise<void> }[]) {
  for (const event of [...events].sort((a, b) => a.at - b.at)) await event.run()
}

describe('random', () => {
  it('repeats its sequence for a seed and stays in [0, 1)', () => {
    const a = random(7)
    const b = random(7)
    const values = Array.from({ length: 50 }, () => a())
    expect(values).toEqual(Array.from({ length: 50 }, () => b()))
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true)
    expect(random(8)()).not.toBe(values[0])
  })
})

describe('typingTimes', () => {
  it('gives one rising time per character, from the start, near the asked rate', () => {
    const text = 'Book the train for Saturday'
    const times = typingTimes(text, 2, 14)
    expect(times).toHaveLength(text.length)
    expect(times[0]).toBe(2)
    expect(times.every((t, i) => i === 0 || t > times[i - 1]!)).toBe(true)
    const rate = (text.length - 1) / (times.at(-1)! - times[0]!)
    expect(rate).toBeGreaterThan(8)
    expect(rate).toBeLessThan(16)
  })

  it('pauses after punctuation longer than any plain gap between letters', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const times = typingTimes('ab. cd', 0, 10, seed)
      expect(times[3]! - times[2]!, `seed ${seed}`).toBeGreaterThan(0.13)
    }
  })
})

describe('glide', () => {
  const a: Point = { x: 0, y: 0 }
  const b: Point = { x: 100, y: 50 }

  it('starts and ends on its points and clamps outside 0 to 1', () => {
    expect(glide(a, b, 0)).toEqual(a)
    expect(glide(a, b, 1)).toEqual(b)
    expect(glide(a, b, -1)).toEqual(a)
    expect(glide(a, b, 2)).toEqual(b)
  })

  it('bows away from the straight line', () => {
    const mid = glide(a, b, 0.5)
    const onLine = mid.y - mid.x / 2
    expect(Math.abs(onLine)).toBeGreaterThan(1)
  })
})

describe('CursorScript', () => {
  const start = { x: 10, y: 20 }

  it('rests where it starts, visible, until the first move', () => {
    const { actions } = recorder()
    const timeline = new CursorScript(start, actions).wait(1).build()
    expect(timeline.duration).toBe(1)
    expect(timeline.cursor(0.5)).toMatchObject({ ...start, opacity: 1, ripple: null, press: 1 })
  })

  it('glides to a target and stays there', async () => {
    const { actions } = recorder()
    const target = { x: 200, y: 120 }
    const timeline = new CursorScript(start, actions).move(target, 0.8).wait(0.5).build()
    await runAll(timeline.events)
    expect(timeline.duration).toBeCloseTo(1.3)
    expect(timeline.cursor(0)).toMatchObject(start)
    expect(timeline.cursor(0.8)).toMatchObject(target)
    expect(timeline.cursor(1.2)).toMatchObject(target)
    const mid = timeline.cursor(0.4)
    expect(mid.x).toBeGreaterThan(start.x)
    expect(mid.x).toBeLessThan(target.x)
  })

  it('resolves a target when its move begins, so it can depend on earlier steps', async () => {
    const { actions } = recorder()
    let opened = false
    const timeline = new CursorScript(start, actions)
      .do(async () => {
        opened = true
      })
      .move(async () => (opened ? { x: 50, y: 60 } : { x: -1, y: -1 }), 0.5)
      .build()
    const events = [...timeline.events].sort((a, b) => a.at - b.at)
    for (const event of events) await event.run()
    expect(timeline.cursor(0.5)).toMatchObject({ x: 50, y: 60 })
  })

  it('presses and releases at the click, with a ripple and a pressed pointer', async () => {
    const { log, actions } = recorder()
    const timeline = new CursorScript(start, actions).wait(0.2).click().wait(1).build()
    const order = [...timeline.events].sort((a, b) => a.at - b.at)
    expect(order).toHaveLength(2)
    expect(order[0]!.at).toBeCloseTo(0.2)
    expect(order[1]!.at).toBeCloseTo(0.3)
    await runAll(timeline.events)
    expect(log).toEqual(['down', 'up'])
    expect(timeline.cursor(0.25).press).toBeLessThan(1)
    expect(timeline.cursor(0.25).ripple).toMatchObject({ ...start })
    expect(timeline.cursor(1.1).ripple).toBeNull()
    expect(timeline.cursor(1.1).press).toBe(1)
  })

  it('hides the pointer while typing and shows it again after', async () => {
    const { log, actions } = recorder()
    const timeline = new CursorScript(start, actions).type('hi\n', { cps: 10 }).wait(0.5).build()
    await runAll(timeline.events)
    expect(log).toEqual(['type h', 'type i', 'press Enter'])
    expect(timeline.cursor(0.25).opacity).toBe(0)
    expect(timeline.cursor(timeline.duration).opacity).toBe(1)
  })

  it('presses keys and runs steps at the current time', async () => {
    const { log, actions } = recorder()
    const timeline = new CursorScript(start, actions).wait(0.3).press('Meta+K').wait(0.2).build()
    expect(timeline.events.map((e) => e.at)).toEqual([0.3])
    await runAll(timeline.events)
    expect(log).toEqual(['press Meta+K'])
  })

  it('reports the time steps end at, for scenes that schedule around them', () => {
    const { actions } = recorder()
    const script = new CursorScript(start, actions).wait(0.4)
    expect(script.time).toBeCloseTo(0.4)
    script.move({ x: 0, y: 0 }, 0.6)
    expect(script.time).toBeCloseTo(1)
  })
})
