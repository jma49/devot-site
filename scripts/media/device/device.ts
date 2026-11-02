import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Point } from '../timeline.ts'

// The real Devot app, for `pnpm media:device`: a page of it reached through the media bridge
// (bridge.ts), with the scenes' Playwright calls answered there, and the mouse and keyboard driven
// through the input helper (input.swift) at the page's place on screen.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

type Text = string | RegExp
type Wire = string | { regex: string; flags: string } | undefined
const wire = (text: Text | undefined): Wire =>
  text instanceof RegExp ? { regex: text.source, flags: text.flags } : text

type Step =
  | { kind: 'role'; role: string; name: Wire; exact: boolean }
  | { kind: 'css'; css: string; hasText: Wire }
  | { kind: 'text'; text: Wire; exact: boolean }
  | { kind: 'nth'; n: number }
  | { kind: 'filter'; hasText: Wire; has: Step[] | undefined }
  | { kind: 'and'; steps: Step[] }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The input helper: one command a line, one answer each. */
export class Input {
  private readonly child: ChildProcess
  private readonly answers: ((line: string) => void)[] = []

  constructor(binary: string) {
    this.child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] })
    createInterface({ input: this.child.stdout! }).on('line', (line) =>
      this.answers.shift()?.(line),
    )
  }

  send(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.answers.push((line) =>
        line.startsWith('ok')
          ? resolve(line)
          : reject(new Error(`E_MEDIA_INPUT ${command}: ${line}`)),
      )
      this.child.stdin!.write(`${command.replace(/\n/g, '\\n')}\n`)
    })
  }

  stop() {
    this.child.stdin!.end()
  }
}

// Virtual key codes (HIToolbox Events.h) for the keys the scenes press.
const KEYS: Record<string, number> = {
  Enter: 36,
  Tab: 48,
  Space: 49,
  Backspace: 51,
  Escape: 53,
  End: 119,
  Home: 115,
  ArrowLeft: 123,
  ArrowRight: 124,
  ArrowDown: 125,
  ArrowUp: 126,
  Slash: 44,
  Comma: 43,
  KeyA: 0,
  KeyS: 1,
  KeyD: 2,
  KeyF: 3,
  KeyH: 4,
  KeyG: 5,
  KeyZ: 6,
  KeyX: 7,
  KeyC: 8,
  KeyV: 9,
  KeyB: 11,
  KeyQ: 12,
  KeyW: 13,
  KeyE: 14,
  KeyR: 15,
  KeyY: 16,
  KeyT: 17,
  KeyO: 31,
  KeyU: 32,
  KeyI: 34,
  KeyP: 35,
  KeyL: 37,
  KeyJ: 38,
  KeyK: 40,
  KeyN: 45,
  KeyM: 46,
}
const MODIFIERS: Record<string, string> = {
  Meta: 'cmd',
  Shift: 'shift',
  Alt: 'alt',
  Control: 'ctrl',
}

export function keyCommand(key: string): string {
  const parts = key.split('+')
  const name = parts.pop()!
  const code = KEYS[name] ?? KEYS[`Key${name.toUpperCase()}`]
  if (code === undefined) throw new Error(`E_MEDIA_KEY ${key}`)
  const mods = parts.map((m) => MODIFIERS[m] ?? '').filter(Boolean)
  return `key ${code}${mods.length ? ` ${mods.join(',')}` : ''}`
}

export class Bridge {
  private readonly url: string

  constructor(url: string) {
    this.url = url
  }

  async call<T>(path: string, fn: string, args: unknown[] = []): Promise<T> {
    const res = await fetch(`${this.url}/__media`, {
      method: 'POST',
      body: JSON.stringify({ path, code: fn, args }),
    })
    const reply = (await res.json()) as { value?: T; error?: string }
    if (reply.error !== undefined) throw new Error(`E_MEDIA_BRIDGE ${path}: ${reply.error}`)
    return reply.value as T
  }

  /** Waits until a page at `path` answers. */
  async ready(path: string, timeout = 60_000): Promise<void> {
    const until = Date.now() + timeout
    for (;;) {
      try {
        if (
          await this.call<boolean>(
            path,
            '() => !!document.querySelector(".window[data-ready], .settings")',
          )
        )
          return
      } catch {
        // Not loaded yet.
      }
      if (Date.now() > until) throw new Error(`E_MEDIA_PAGE_NOT_READY ${path}`)
      await sleep(250)
    }
  }
}

export class DeviceLocator {
  readonly page: DevicePage
  readonly steps: Step[]

  constructor(page: DevicePage, steps: Step[]) {
    this.page = page
    this.steps = steps
  }

  private with(step: Step) {
    return new DeviceLocator(this.page, [...this.steps, step])
  }

  getByRole(role: string, options: { name?: Text; exact?: boolean } = {}) {
    return this.with({ kind: 'role', role, name: wire(options.name), exact: !!options.exact })
  }

  locator(css: string, options: { hasText?: Text } = {}) {
    return this.with({ kind: 'css', css, hasText: wire(options.hasText) })
  }

  getByText(text: Text, options: { exact?: boolean } = {}) {
    return this.with({ kind: 'text', text: wire(text), exact: !!options.exact })
  }

  first() {
    return this.with({ kind: 'nth', n: 0 })
  }

  last() {
    return this.with({ kind: 'nth', n: -1 })
  }

  nth(n: number) {
    return this.with({ kind: 'nth', n })
  }

  filter(options: { hasText?: Text; has?: DeviceLocator }) {
    return this.with({ kind: 'filter', hasText: wire(options.hasText), has: options.has?.steps })
  }

  and(other: DeviceLocator) {
    return this.with({ kind: 'and', steps: other.steps })
  }

  private run<T>(fn: string, ...args: unknown[]): Promise<T> {
    return this.page.call<T>(fn, [this.steps, ...args])
  }

  count() {
    return this.run<number>('(m, steps) => m.query(steps).length')
  }

  isVisible() {
    return this.run<boolean>(
      '(m, steps) => { const el = m.query(steps)[0]; return !!el && m.visible(el) }',
    )
  }

  async waitFor({
    state = 'visible',
    timeout = 15_000,
  }: { state?: string; timeout?: number } = {}) {
    const until = Date.now() + timeout
    for (;;) {
      const shown = await this.isVisible()
      if (state === 'hidden' || state === 'detached' ? !shown : shown) return
      if (Date.now() > until) throw new Error(`E_MEDIA_WAIT ${state} ${JSON.stringify(this.steps)}`)
      await sleep(100)
    }
  }

  /** In the main page's coordinates, as Playwright gives a box inside a frame. */
  async boundingBox(): Promise<Rect | null> {
    const box = await this.run<Rect | null>(
      '(m, steps) => { const el = m.query(steps)[0]; return el ? m.rect(el) : null }',
    )
    const { x, y } = this.page.frameOffset
    return box && { ...box, x: box.x + x, y: box.y + y }
  }

  evaluate<T, A>(fn: (el: never, arg: A) => T | Promise<T>, arg?: A): Promise<T> {
    return this.run<T>(
      `(m, steps, src, arg) => { const el = m.query(steps)[0]; if (!el) throw new Error('E_MEDIA_NO_ELEMENT'); return (0, eval)('(' + src + ')')(el, arg) }`,
      fn.toString(),
      arg,
    )
  }

  getAttribute(name: string) {
    return this.evaluate((el: Element, n: string) => el.getAttribute(n), name)
  }

  inputValue() {
    return this.evaluate((el: HTMLInputElement) => el.value)
  }

  allTextContents() {
    return this.run<string[]>('(m, steps) => m.query(steps).map((el) => el.textContent || "")')
  }

  async focus() {
    await this.waitFor()
    await this.evaluate((el: HTMLElement) => el.focus())
  }

  /** As Playwright's click does, the element is scrolled into view first. */
  async click() {
    await this.waitFor()
    await this.evaluate((el: Element) => el.scrollIntoView({ block: 'nearest' }))
    await sleep(150)
    const box = (await this.boundingBox())!
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await sleep(120)
    await this.page.mouse.down()
    await sleep(60)
    await this.page.mouse.up()
    await sleep(250)
  }

  async type(text: string) {
    await this.focus()
    await this.page.keyboard.type(text)
  }

  async press(key: string) {
    await this.focus()
    await this.page.keyboard.press(key)
  }
}

/**
 * One window's page. Devot's main window draws its page under the title bar, so its origin is the
 * window's own corner; the Settings window's page stands for the scenes' Settings frame.
 */
export class DevicePage {
  /** Where the main page's top left sits on screen, in points; the pointer moves from there. */
  origin: Point = { x: 0, y: 0 }
  /** For the Settings window's page: its top left in the main page's coordinates. */
  frameOffset: Point = { x: 0, y: 0 }
  /** Opens the real Settings window; the scenes' openSettingsWindow uses it on a device. */
  openSettingsWindow?: () => Promise<DevicePage>
  settings?: DevicePage

  readonly path: string
  private readonly bridge: Bridge
  private readonly input: Input

  constructor(path: string, bridge: Bridge, input: Input) {
    this.path = path
    this.bridge = bridge
    this.input = input
  }

  call<T>(fn: string, args: unknown[] = []): Promise<T> {
    return this.bridge.call<T>(this.path, fn, args)
  }

  readonly mouse = {
    move: async (x: number, y: number) => {
      await this.input.send(
        `move ${(this.origin.x + x).toFixed(1)} ${(this.origin.y + y).toFixed(1)}`,
      )
    },
    down: async () => void (await this.input.send('down')),
    up: async () => void (await this.input.send('up')),
  }

  readonly keyboard = {
    press: async (key: string) => void (await this.input.send(keyCommand(key))),
    type: async (text: string) => {
      for (const ch of text) {
        if (ch === '\n') await this.input.send(keyCommand('Enter'))
        else if (ch === '\t') await this.input.send(keyCommand('Tab'))
        else await this.input.send(`text ${ch}`)
      }
    },
  }

  getByRole(role: string, options?: { name?: Text; exact?: boolean }) {
    return new DeviceLocator(this, []).getByRole(role, options)
  }

  locator(css: string, options?: { hasText?: Text }) {
    return new DeviceLocator(this, []).locator(css, options)
  }

  getByText(text: Text, options?: { exact?: boolean }) {
    return new DeviceLocator(this, []).getByText(text, options)
  }

  frameLocator(_selector: string): DevicePage {
    if (!this.settings) throw new Error('E_MEDIA_NO_SETTINGS_WINDOW')
    return this.settings
  }

  frames() {
    return [this]
  }

  mainFrame() {
    return this
  }

  evaluate<T, A>(fn: (arg: A) => T | Promise<T>, arg?: A): Promise<T> {
    return this.call<T>(`(m, src, arg) => (0, eval)('(' + src + ')')(arg)`, [fn.toString(), arg])
  }

  waitForTimeout(ms: number) {
    return sleep(ms)
  }
}

/** System Events, for a window of the process with `pid`. */
export function windows(
  pid: number,
): { name: string; x: number; y: number; width: number; height: number }[] {
  const out = execFileSync('osascript', [
    '-e',
    `tell application "System Events" to tell (first process whose unix id is ${pid})
       set out to ""
       repeat with w in windows
         set {px, py} to position of w
         set {sw, sh} to size of w
         set out to out & (name of w) & tab & px & tab & py & tab & sw & tab & sh & linefeed
       end repeat
       return out
     end tell`,
  ]).toString()
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, x, y, width, height] = line.split('\t')
      return { name: name!, x: +x!, y: +y!, width: +width!, height: +height! }
    })
}

export function placeWindow(pid: number, index: number, rect: Rect) {
  execFileSync('osascript', [
    '-e',
    `tell application "System Events" to tell (first process whose unix id is ${pid})
       set frontmost to true
       set position of window ${index} to {${rect.x}, ${rect.y}}
       set size of window ${index} to {${rect.width}, ${rect.height}}
     end tell`,
  ])
}

export function bringToFront(pid: number) {
  execFileSync('osascript', [
    '-e',
    `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`,
  ])
}
