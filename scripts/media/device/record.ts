import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Scheme } from '../../../src/media.ts'
import { framesDir, type Captured } from '../capture.ts'
import { frameFile } from '../encode.ts'
import { smallestText } from '../frames.ts'
import type { FilmScene } from '../film-scenes.ts'
import { frameRect, type Scene } from '../scenes.ts'
import { VIEW } from '../seed.ts'
import {
  Bridge,
  DevicePage,
  Input,
  bringToFront,
  placeWindow,
  windows,
  type Rect,
} from './device.ts'
import { STILL, masterFile, masterNote, recordingArea, type Master } from './film.ts'

// Records a scene from the real Devot app: a fresh library in the demo build's own data folder,
// the window placed on a still wallpaper, the scene's script played in real time with the real
// pointer and keyboard, and the screen recorded around the window. The frames land where
// `pnpm media:capture` puts its own, so `pnpm media:encode` encodes them the same way.

export interface DeviceContext {
  cache: string
  /** The Devot checkout the app was built from and whose dev server runs (bridge.ts). */
  devotDir: string
  /** The app's binary, built by `tauri dev` with the demo identifier. */
  binary: string
  /** The demo build's data folder. */
  dataDir: string
  devUrl: string
  fps: number
  input: Input
  screen: { width: number; height: number; scale: number }
  /** Records the whole window as a master for the film (film.ts) and leaves the clips alone. */
  fullWindow: boolean
  log: (line: string) => void
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const DEMO_IDENTIFIER = 'io.github.jma49.devot.demo'
export const demoDataDir = () =>
  join(homedir(), 'Library/Application Support', `${DEMO_IDENTIFIER}.dev`)

/**
 * Writes the demo library into a new database at `db` through Devot's own services (devot/seed.ts,
 * run with Vitest in the checkout), and the note IDs by key to `ids`.
 */
export function writeLibrary(devotDir: string, db: string, ids: string) {
  const test = join(devotDir, 'tests', 'media-seed.demo.test.ts')
  copyFileSync(join(import.meta.dirname, 'devot', 'seed.ts'), test)
  try {
    execFileSync('pnpm', ['exec', 'vitest', 'run', test, '--reporter=dot'], {
      cwd: devotDir,
      env: {
        ...process.env,
        MEDIA_DB: db,
        MEDIA_LIBRARY: join(import.meta.dirname, '..', 'library.ts'),
        MEDIA_IDS: ids,
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    })
  } finally {
    rmSync(test, { force: true })
  }
}

function seed(ctx: DeviceContext, scene: Scene | FilmScene, scheme: Scheme) {
  rmSync(ctx.dataDir, { recursive: true, force: true })
  mkdirSync(ctx.dataDir, { recursive: true })
  const settings = {
    appearance: scheme,
    lightTheme: 'tide',
    darkTheme: 'tide',
    sidebarMaterial: true,
    // The gradient themes are solid until Settings > Appearance > Gradient is raised.
    ...(process.env['MEDIA_GRADIENT'] && {
      gradientStrength: Number(process.env['MEDIA_GRADIENT']),
    }),
    ...scene.settings,
  }
  writeFileSync(join(ctx.dataDir, 'editor-settings.json'), JSON.stringify(settings, null, 2))
  const ids = join(ctx.cache, 'device-ids.json')
  writeLibrary(ctx.devotDir, join(ctx.dataDir, 'devot.sqlite'), ids)
  // A backup from a moment ago, so the footer says the library is backed up.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync(join(ctx.dataDir, 'backups'), { recursive: true })
  copyFileSync(
    join(ctx.dataDir, 'devot.sqlite'),
    join(ctx.dataDir, 'backups', `devot-${stamp}-1.sqlite`),
  )
  return JSON.parse(readFileSync(ids, 'utf8')) as Record<string, string>
}

async function launch(ctx: DeviceContext): Promise<ChildProcess> {
  // The app writes its last view on the way out, so storage is emptied before it starts (cli.ts
  // keeps the folder's own contents aside).
  rmSync(join(homedir(), 'Library/WebKit/devot'), { recursive: true, force: true })
  const app = spawn(ctx.binary, [], { stdio: 'ignore', detached: false })
  return app
}

async function quit(app: ChildProcess) {
  if (app.exitCode !== null) return
  app.kill('SIGTERM')
  for (let i = 0; i < 40 && app.exitCode === null; i++) await sleep(100)
  if (app.exitCode === null) app.kill('SIGKILL')
}

/** The screen rectangle of the window, centred on the screen, for a page of `size`. */
function windowRect(ctx: DeviceContext, size: { width: number; height: number }): Rect {
  return {
    x: Math.round((ctx.screen.width - size.width) / 2),
    y: Math.round((ctx.screen.height - size.height) / 2) + 12,
    width: size.width,
    height: size.height,
  }
}

function startRecording(ctx: DeviceContext, file: string, area: Rect): ChildProcess {
  const s = ctx.screen.scale
  const crop = `crop=${area.width * s}:${area.height * s}:${area.x * s}:${area.y * s}`
  return spawn(
    'ffmpeg',
    [
      ...['-y', '-loglevel', 'error'],
      ...['-f', 'avfoundation', '-capture_cursor', '1', '-framerate', String(ctx.fps)],
      ...['-use_wallclock_as_timestamps', '1'],
      ...['-i', 'Capture screen 0:none'],
      ...['-vf', crop, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0'],
      ...['-copyts', file],
    ],
    { stdio: ['pipe', 'ignore', 'inherit'] },
  )
}

async function stopRecording(rec: ChildProcess) {
  rec.stdin!.write('q')
  rec.stdin!.end()
  await new Promise((resolve) => rec.once('exit', resolve))
}

function firstFrameAt(file: string): number {
  const out = execFileSync(
    'ffprobe',
    [
      ...['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time'],
      ...['-read_intervals', '%+#1', '-of', 'csv=p=0', file],
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  )
  return parseFloat(out.toString().trim())
}

export async function recordScene(ctx: DeviceContext, scene: Scene | FilmScene, scheme: Scheme) {
  const label = `${scene.slot} ${scheme}`
  seed(ctx, scene, scheme)
  const bridge = new Bridge(ctx.devUrl)
  await ctx.input.send(`backdrop ${scheme}`)
  const app = await launch(ctx)
  let rec: ChildProcess | undefined
  try {
    const page = new DevicePage('/', bridge, ctx.input)
    await bridge.ready('/')
    await page.evaluate(
      (view: Record<string, string>) => {
        for (const [key, value] of Object.entries(view)) localStorage.setItem(key, value)
        location.reload()
      },
      { ...VIEW, ...scene.view },
    )
    await sleep(800)
    await bridge.ready('/')
    // The app always draws its scroll bar thumbs; a clip reads cleaner without them, the editor's
    // too, inside its shadow root (as the browser capture hides them, browser.ts).
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync('::-webkit-scrollbar-thumb { background: transparent !important; }')
      const adopt = (root: Document | ShadowRoot) => {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
      }
      adopt(document)
      for (const el of document.querySelectorAll('*')) if (el.shadowRoot) adopt(el.shadowRoot)
      const attach = Element.prototype.attachShadow
      Element.prototype.attachShadow = function (init) {
        const root = attach.call(this, init)
        adopt(root)
        return root
      }
    })
    const placed = windowRect(ctx, scene.viewport)
    placeWindow(app.pid!, 1, placed)
    await sleep(600)
    const inner = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    if (inner.width !== scene.viewport.width || inner.height !== scene.viewport.height) {
      throw new Error(`E_MEDIA_WINDOW ${label} page ${inner.width}x${inner.height}`)
    }
    page.origin = { x: placed.x, y: placed.y }
    page.openSettingsWindow = async () => {
      await page.keyboard.press('Meta+Comma')
      const settings = new DevicePage('/settings.html', bridge, ctx.input)
      await bridge.ready('/settings.html')
      const index = windows(app.pid!).findIndex((w) => w.name === 'Settings') + 1
      if (index === 0) throw new Error('E_MEDIA_NO_SETTINGS_WINDOW')
      const current = windows(app.pid!)[index - 1]!
      placeWindow(app.pid!, index, {
        x: placed.x + 40,
        y: placed.y + 40,
        width: current.width,
        height: current.height,
      })
      await sleep(400)
      // The page's corner on screen: below the title bar the system draws for this window.
      const win = windows(app.pid!)[index - 1]!
      const settingsPage = await settings.evaluate(() => ({ h: innerHeight }))
      settings.origin = page.origin
      settings.frameOffset = {
        x: win.x - page.origin.x,
        y: win.y + (win.height - settingsPage.h) - page.origin.y,
      }
      page.settings = settings
      return settings
    }
    bringToFront(app.pid!)
    await scene.prepare(page as never)
    const timeline = await scene.script(page as never, {
      down: () => page.mouse.down(),
      up: () => page.mouse.up(),
      type: (text) => page.keyboard.type(text),
      press: (key) => page.keyboard.press(key),
    })
    const start = timeline.cursor(0)
    await page.mouse.move(start.x, start.y)
    const area = recordingArea(frameRect(scene), placed, ctx.fullWindow)
    const video = ctx.fullWindow
      ? masterFile(ctx.cache, scene.slot, scheme)
      : join(ctx.cache, 'device', `${scene.slot}-${scheme}.mkv`)
    mkdirSync(join(video, '..'), { recursive: true })
    rmSync(video, { force: true })
    // A master keeps a still moment on either side of its script.
    const rest = ctx.fullWindow ? (STILL + 0.4) * 1000 : 500
    rec = startRecording(ctx, video, area)
    // The script starts once the recording has its first frame, so the clip's start is in it.
    for (let i = 0; ; i++) {
      await sleep(250)
      try {
        if (Number.isFinite(firstFrameAt(video))) break
      } catch {
        // No frame written yet.
      }
      if (i > 60) throw new Error(`E_MEDIA_RECORDING ${label}`)
    }
    await sleep(rest)
    const events = [...timeline.events].sort((a, b) => a.at - b.at)
    const began = Date.now()
    let next = 0
    let minText = [Infinity, Infinity]
    let measured = false
    for (;;) {
      const t = (Date.now() - began) / 1000
      while (next < events.length && events[next]!.at <= t) {
        await events[next]!.run()
        next++
      }
      if (t >= timeline.duration) break
      const cursor = timeline.cursor(t)
      await page.mouse.move(cursor.x, cursor.y)
      if (!ctx.fullWindow && !measured && t >= timeline.posterTime) {
        measured = true
        const rects = scene.phone ? [scene.clip, scene.phone.rect] : [scene.clip]
        minText = (await smallestText(page as never, rects)).map((s) => s.size)
      }
      await sleep(8)
    }
    while (next < events.length) await events[next++]!.run()
    await sleep(rest)
    await stopRecording(rec)
    rec = undefined
    await scene.check?.(page as never)

    const offset = began / 1000 - firstFrameAt(video)
    if (offset < 0) throw new Error(`E_MEDIA_LATE_RECORDING ${label} ${offset.toFixed(2)} s`)
    if (ctx.fullWindow) {
      const s = ctx.screen.scale
      const master: Master = {
        id: scene.slot,
        scheme,
        points: [area.width, area.height],
        pixels: [area.width * s, area.height * s],
        fps: ctx.fps,
        start: offset,
        duration: timeline.duration,
        beats: timeline.beats,
      }
      writeFileSync(masterNote(ctx.cache, scene.slot, scheme), JSON.stringify(master, null, 2))
      ctx.log(
        `${label} master ${timeline.duration.toFixed(2)} s, script from ${offset.toFixed(2)} s`,
      )
      return
    }
    const count = Math.round(timeline.duration * ctx.fps)
    const dir = framesDir(ctx.cache, (scene as Scene).slot, scheme)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const out = scene.output
    execFileSync('ffmpeg', [
      ...['-v', 'error', '-ss', offset.toFixed(3), '-i', video],
      ...['-frames:v', String(count), '-start_number', '0'],
      ...['-vf', `fps=${ctx.fps}`],
      join(dir, '%05d.png'),
    ])
    if (!existsSync(frameFile(dir, count - 1))) throw new Error(`E_MEDIA_SHORT ${label}`)
    const captured: Captured = {
      frames: dir,
      count,
      fps: ctx.fps,
      fade: scene.fade,
      width: out.width,
      height: out.height,
      posterTime: timeline.posterTime,
      minText: minText[0] ?? Infinity,
      ...(scene.phone && { phoneMinText: minText[1] }),
    }
    writeFileSync(join(dir, 'clip.json'), JSON.stringify(captured))
    ctx.log(`${label} ${count} frames, recording from ${offset.toFixed(2)} s`)
  } catch (error) {
    if (rec) await stopRecording(rec)
    const shot = join(ctx.cache, 'device', `${scene.slot}-${scheme}-error.png`)
    mkdirSync(join(ctx.cache, 'device'), { recursive: true })
    execFileSync('screencapture', ['-x', shot])
    ctx.log(`${label} failed; the screen at that moment: ${shot}`)
    throw error
  } finally {
    await quit(app)
  }
}
