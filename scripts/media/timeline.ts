// A clip's script on its own clock: where the soft pointer is at any moment, and the input events
// (clicks, keys, steps of the scene) due by then. frames.ts renders it one frame at a time.

export interface Point {
  x: number
  y: number
}

/** The page input a script drives; frames.ts binds it to Playwright's mouse and keyboard. */
export interface Actions {
  down(): Promise<void>
  up(): Promise<void>
  type(text: string): Promise<void>
  press(key: string): Promise<void>
}

export interface ClipEvent {
  at: number
  run: () => Promise<void>
}

export interface CursorFrame extends Point {
  opacity: number
  /** 0 to 1 through a click's ripple, or null when none shows. */
  ripple: (Point & { progress: number }) | null
  /** 1 at rest, a little less while the button is down. */
  press: number
}

export interface Timeline {
  duration: number
  events: ClipEvent[]
  cursor(t: number): CursorFrame
}

/** Seeded, so a clip types with the same rhythm every run. */
export function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SYMBOLS = new Set('$\\{}^_[]()*`|<>#=')

/**
 * Key times for `text` typed from `start` with a person's rhythm: about `cps` characters a second,
 * a beat longer after a space or punctuation and before reaching for a symbol, and the odd pause.
 */
export function typingTimes(text: string, start: number, cps: number, seed = 7): number[] {
  const next = random(seed)
  const base = 1 / cps
  const times: number[] = []
  let t = start
  const chars = [...text]
  for (let i = 0; i < chars.length; i++) {
    times.push(t)
    const ch = chars[i]!
    const after = chars[i + 1] ?? ''
    let gap = base * (0.7 + 0.6 * next())
    if (ch === ' ') gap += base * 0.25
    if (',.;:'.includes(ch)) gap += base * 1.2
    if (ch === '\n') gap += base * 2
    if (SYMBOLS.has(after) && !SYMBOLS.has(ch)) gap += base * 0.6
    if (next() < 0.05) gap += base * 1.5
    t += gap
  }
  return times
}

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** A point along a gentle arc from `a` to `b`: a hand never moves a pointer in a straight line. */
export function glide(a: Point, b: Point, progress: number, bend = 0.12): Point {
  const p = easeInOut(clamp01(progress))
  if (p === 0) return { x: a.x, y: a.y }
  if (p === 1) return { x: b.x, y: b.y }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const cx = (a.x + b.x) / 2 - dy * bend
  const cy = (a.y + b.y) / 2 + dx * bend
  const u = 1 - p
  return {
    x: u * u * a.x + 2 * u * p * cx + p * p * b.x,
    y: u * u * a.y + 2 * u * p * cy + p * p * b.y,
  }
}

export type Target = Point | (() => Promise<Point>)

interface Move {
  at: number
  duration: number
  bend: number
  to: Point | undefined
}

interface Fade {
  at: number
  duration: number
  to: number
}

const CLICK_HOLD = 0.1
const RIPPLE = 0.55
const PRESSED = 0.88

/**
 * Builds a clip step by step: `move` glides the pointer, `click` presses at the pointer, `type`
 * types with a person's rhythm while the pointer hides (as macOS hides it), `do` runs a scene step.
 * A target given as a function is looked up when its move begins, after every earlier step ran.
 */
export class CursorScript {
  private t = 0
  private readonly start: Point
  private readonly actions: Actions
  private readonly events: ClipEvent[] = []
  private readonly moves: Move[] = []
  private readonly fades: Fade[] = []
  private readonly clicks: number[] = []

  constructor(start: Point, actions: Actions) {
    this.start = start
    this.actions = actions
  }

  get time(): number {
    return this.t
  }

  wait(seconds: number): this {
    this.t += seconds
    return this
  }

  move(target: Target, seconds: number, { bend = 0.12 } = {}): this {
    const move: Move = { at: this.t, duration: seconds, bend, to: undefined }
    if (typeof target === 'function') {
      this.events.push({
        at: this.t,
        run: async () => {
          move.to = await target()
        },
      })
    } else {
      move.to = target
    }
    if (this.opacityAt(this.t) < 1) this.show()
    this.moves.push(move)
    this.t += seconds
    return this
  }

  click(): this {
    const at = this.t
    this.events.push({ at, run: () => this.actions.down() })
    this.events.push({ at: at + CLICK_HOLD, run: () => this.actions.up() })
    this.clicks.push(at)
    this.t += CLICK_HOLD
    return this
  }

  type(text: string, { cps = 14, seed = 7, showAfter = 0.35 } = {}): this {
    this.hide(0.12)
    const chars = [...text]
    const times = typingTimes(text, this.t, cps, seed)
    chars.forEach((ch, i) => {
      const run =
        ch === '\n'
          ? () => this.actions.press('Enter')
          : ch === '\t'
            ? () => this.actions.press('Tab')
            : () => this.actions.type(ch)
      this.events.push({ at: times[i]!, run })
    })
    this.t = (times.at(-1) ?? this.t) + 1 / cps
    if (showAfter >= 0) {
      this.t += showAfter
      this.show()
    }
    return this
  }

  press(key: string): this {
    this.events.push({ at: this.t, run: () => this.actions.press(key) })
    return this
  }

  do(run: () => Promise<void>): this {
    this.events.push({ at: this.t, run })
    return this
  }

  hide(seconds = 0.15): this {
    this.fades.push({ at: this.t, duration: seconds, to: 0 })
    return this
  }

  show(seconds = 0.15): this {
    this.fades.push({ at: this.t, duration: seconds, to: 1 })
    return this
  }

  build(): Timeline {
    return {
      duration: this.t,
      events: [...this.events],
      cursor: (t) => {
        const at = this.positionAt(t)
        const click = this.clicks.findLast((c) => c <= t)
        const ripple =
          click !== undefined && t < click + RIPPLE
            ? { ...this.positionAt(click), progress: (t - click) / RIPPLE }
            : null
        const pressed = click !== undefined && t < click + CLICK_HOLD + 0.06
        return { ...at, opacity: this.opacityAt(t), ripple, press: pressed ? PRESSED : 1 }
      },
    }
  }

  private positionAt(t: number): Point {
    let from = this.start
    for (const move of this.moves) {
      if (t < move.at) break
      const to = move.to ?? from
      if (t < move.at + move.duration)
        return glide(from, to, (t - move.at) / move.duration, move.bend)
      from = to
    }
    return { x: from.x, y: from.y }
  }

  private opacityAt(t: number): number {
    let value = 1
    for (const [i, fade] of this.fades.entries()) {
      if (t < fade.at) break
      const next = this.fades[i + 1]
      const until = next && next.at <= t ? next.at : t
      value += (fade.to - value) * clamp01((until - fade.at) / fade.duration)
    }
    return value
  }
}
