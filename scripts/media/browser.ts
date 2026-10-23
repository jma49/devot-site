import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type {
  Browser,
  BrowserContext,
  Page,
  expect as Expect,
  webkit as WebKit,
} from '@playwright/test'
import type { Scheme } from '../../src/media.ts'

/** SF Symbols drawn on this Mac the way the app's native `symbol_png` command draws them. */
export class SymbolRenderer {
  private process: ChildProcess | undefined
  private readonly queue: ((png: string) => void)[] = []
  private readonly cache = new Map<string, Promise<string>>()
  private readonly binary: string

  constructor(binDir: string) {
    this.binary = join(binDir, 'render-symbol')
  }

  render(name: string, pointSize: number, weight: string): Promise<string> {
    const key = `${name} ${pointSize} ${weight}`
    let entry = this.cache.get(key)
    if (!entry) {
      entry = new Promise<string>((resolve) => {
        this.queue.push(resolve)
        this.start().stdin!.write(`${key}\n`)
      })
      this.cache.set(key, entry)
    }
    return entry
  }

  private start(): ChildProcess {
    if (this.process) return this.process
    if (!existsSync(this.binary)) {
      mkdirSync(join(this.binary, '..'), { recursive: true })
      const source = join(import.meta.dirname, 'symbols', 'render-symbol.swift')
      execFileSync('swiftc', ['-O', source, '-o', this.binary], { stdio: 'ignore' })
    }
    const child = spawn(this.binary, [], { stdio: ['pipe', 'pipe', 'ignore'] })
    createInterface({ input: child.stdout! }).on('line', (line) =>
      this.queue.shift()?.(line.trim()),
    )
    this.process = child
    return child
  }

  stop() {
    this.process?.kill()
  }
}

const ZONES = [
  'Pacific/Honolulu',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Atlantic/Azores',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Athens',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
]

/** A time zone where it is late morning now, so the times the app shows look like a working day. */
export function daytimeZone(now = new Date()): string {
  const hour = (zone: string) =>
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(now),
    )
  const distance = (zone: string) => Math.abs(hour(zone) + now.getUTCMinutes() / 60 - 11)
  return process.env['MEDIA_TZ'] ?? [...ZONES].sort((a, b) => distance(a) - distance(b))[0]!
}

export interface AppOptions {
  baseURL: string
  devotDir: string
  symbols: SymbolRenderer
  scheme: Scheme
  viewport: { width: number; height: number }
  /** Editor settings over the app's defaults (core/editorSettings.ts). */
  settings: Record<string, unknown>
  /** The app's own motion, stepped on the clip's clock (frames.ts); off, every change lands at once. */
  motion: boolean
}

// The app always draws its scroll bar thumbs (app.css); a still frame reads cleaner without them,
// the editor's too, inside its shadow root.
const HIDE_SCROLLBARS = `{
  const sheet = new CSSStyleSheet()
  sheet.replaceSync('::-webkit-scrollbar-thumb { background: transparent !important; }')
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  const attach = Element.prototype.attachShadow
  Element.prototype.attachShadow = function (init) {
    const root = attach.call(this, init)
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    return root
  }
}`

// Holds every CSS and Web Animation on the clip's clock: each frame sets their time from it, so a
// slide or a fade advances one frame per frame however long a screenshot takes.
const ANIMATION_CLOCK = `{
  const starts = new WeakMap()
  globalThis.mediaClock = (t) => {
    for (const animation of document.getAnimations()) {
      if (!starts.has(animation)) starts.set(animation, t - (Number(animation.currentTime) || 0) / 1000)
      const local = (t - starts.get(animation)) * 1000
      const end = animation.effect ? animation.effect.getComputedTiming().endTime : Infinity
      if (Number.isFinite(end) && local >= end) {
        animation.finish()
      } else {
        animation.pause()
        animation.currentTime = local
      }
    }
    for (const frame of document.querySelectorAll('iframe')) frame.contentWindow?.mediaClock?.(t)
  }
}`

interface MediaWindow {
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args: Record<string, unknown>, o?: unknown) => Promise<unknown>
  }
  devotEditorSettings?: Record<string, unknown>
  devotEditorRevision?: number
  mediaRenderSymbol: (name: string, size: number, weight: string) => Promise<string>
  mediaSettingsChanged?: (patch: unknown) => void
  top: MediaWindow | null
  dispatchEvent(event: Event): boolean
}

export interface AppPage {
  context: BrowserContext
  page: Page
  problems: string[]
}

/** A 2x WebKit page of the UI-test build: Tauri mocked as in devot's UI tests, real SF Symbols. */
export async function openApp(browser: Browser, options: AppOptions): Promise<AppPage> {
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: 2,
    colorScheme: options.scheme,
    reducedMotion: options.motion ? 'no-preference' : 'reduce',
    baseURL: options.baseURL,
    locale: 'en-US',
    timezoneId: daytimeZone(),
  })
  const page = await context.newPage()
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(`pageerror ${String(e).slice(0, 160)}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console ${m.text().slice(0, 160)}`)
  })
  const fixtures = (await import(join(options.devotDir, 'tests/ui/fixtures.ts'))) as {
    mockTauri: (page: Page) => Promise<void>
  }
  await fixtures.mockTauri(page)
  await page.exposeFunction('mediaRenderSymbol', (name: string, size: number, weight: string) =>
    options.symbols.render(name, size, weight),
  )
  const settings = { ...options.settings, ...(options.motion ? { animations: 'always' } : {}) }
  await page.addInitScript((initial) => {
    const w = globalThis as unknown as MediaWindow
    w.devotEditorSettings = initial
    const internals = w['__TAURI_INTERNALS__']
    const original = internals.invoke
    internals.invoke = async (cmd, args, o) => {
      if (cmd === 'symbol_png') {
        const png = await w.mediaRenderSymbol(
          String(args['name']),
          Number(args['pointSize']),
          String(args['weight'] ?? 'regular'),
        )
        if (!png) throw 'E_SYMBOL_UNAVAILABLE'
        return png
      }
      const result = await original(cmd, args, o)
      // A window shown in a frame (scenes.ts, the Settings window) reaches the main window as
      // Rust's settings event does in the app.
      if (cmd === 'editor_settings_set' && w.top !== w) w.top?.mediaSettingsChanged?.(args['patch'])
      return result
    }
    if (w.top === w) {
      w.mediaSettingsChanged = (patch) => {
        w.devotEditorSettings = { ...w.devotEditorSettings, ...(patch as object) }
        w.devotEditorRevision = (w.devotEditorRevision ?? 0) + 1
        const detail = {
          revision: w.devotEditorRevision,
          settings: { animations: 'system', ...w.devotEditorSettings },
        }
        w.dispatchEvent(new CustomEvent('devot:editor-settings-changed', { detail }))
      }
    }
  }, settings)
  await page.addInitScript(HIDE_SCROLLBARS)
  if (options.motion) await page.addInitScript(ANIMATION_CLOCK)
  return { context, page, problems }
}

/**
 * Devot's own Playwright, the one its UI tests and mockTauri run on: Playwright refuses to load a
 * second copy of itself in one process, and this one's WebKit is the build devot is tested in.
 */
export async function devotPlaywright(
  devotDir: string,
): Promise<{ webkit: typeof WebKit; expect: typeof Expect }> {
  const entry = join(devotDir, 'node_modules', '@playwright', 'test', 'index.mjs')
  return (await import(pathToFileURL(entry).href)) as {
    webkit: typeof WebKit
    expect: typeof Expect
  }
}

export async function launch(devotDir: string): Promise<Browser> {
  const { webkit } = await devotPlaywright(devotDir)
  return webkit.launch()
}
