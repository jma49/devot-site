import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { loadavg } from 'node:os'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import { slotPaths, type Edge, type SlotName } from '../../src/media.ts'
import { launch, openApp, SymbolRenderer } from './browser.ts'
import {
  ffmpeg,
  fitPoster,
  frameFile,
  START_QUALITY,
  videoArgs,
  withinBudget,
  type ClipInput,
} from './encode.ts'
import { pageActions, renderFrames } from './frames.ts'
import { edgesOf } from './manifest.ts'
import { mp4Info } from './mp4.ts'
import { installOverlay } from './overlay.ts'
import { SCENES, type Scene } from './scenes.ts'
import { seedLibrary, VIEW } from './seed.ts'

export interface CaptureContext {
  root: string
  cache: string
  devotDir: string
  baseURL: string
  fps: number
  log: (line: string) => void
}

const KB = 1024
/** Under the limits in tests/unit/media.test.ts, with room to spare. */
const POSTER_BUDGET = 78 * KB
const CLIP_BUDGET = 690 * KB
const HERO_BUDGET = 2020 * KB

const framesDir = (cache: string, slot: SlotName) => join(cache, 'frames', slot)

/** Waits while the machine is busy (one-minute load of 24 or more), for at most 15 minutes. */
export async function waitForQuietMachine(log: (line: string) => void): Promise<void> {
  for (let tries = 0; tries < 30; tries++) {
    const load = loadavg()[0] ?? 0
    if (load < 24) return
    log(`load ${load.toFixed(1)}: waiting 30 s`)
    await new Promise((resolve) => setTimeout(resolve, 30_000))
  }
  log('still busy after 15 minutes: capturing anyway')
}

async function captureScene(
  browser: Browser,
  scene: Scene,
  ctx: CaptureContext,
  symbols: SymbolRenderer,
) {
  const { context, page, problems } = await openApp(browser, {
    baseURL: ctx.baseURL,
    devotDir: ctx.devotDir,
    symbols,
    scheme: 'light',
    viewport: scene.viewport,
    settings: { sidebarMaterial: false, theme: 'tide', ...scene.settings },
    motion: scene.motion,
  })
  try {
    await page.goto('/')
    await page.locator('.window[data-ready]').waitFor()
    await seedLibrary(page, ctx.devotDir, { ...VIEW, ...scene.view })
    await scene.prepare(page)
    await installOverlay(page)
    const timeline = await scene.script(page, pageActions(page))
    const dir = framesDir(ctx.cache, scene.slot)
    const count = await renderFrames(page, timeline, {
      dir,
      fps: ctx.fps,
      clip: scene.clip,
      motion: scene.motion,
      log: (line) => ctx.log(`${scene.slot} ${line}`),
    })
    await scene.check?.(page)
    const alerts = await page
      .locator('[role="alert"]:visible, .toast:visible, .island-error:visible')
      .count()
    if (problems.length > 0 || alerts > 0) {
      throw new Error(`E_MEDIA_PAGE ${scene.slot}: ${alerts} alerts; ${problems.join(' | ')}`)
    }
    const clip: ClipInput = {
      frames: dir,
      count,
      fps: ctx.fps,
      fade: scene.fade,
      width: scene.output.width,
      height: scene.output.height,
    }
    writeFileSync(join(dir, 'clip.json'), JSON.stringify(clip))
    ctx.log(`${scene.slot} ${count} frames, ${(count / ctx.fps).toFixed(2)} s`)
  } finally {
    await context.close()
  }
}

export interface Encoded {
  slot: SlotName
  width: number
  height: number
  duration: number
  edges: Edge[]
  files: { path: string; bytes: number; quality: number }[]
}

/** MP4 (H.264) and WebM (AV1) within the slot's budget, and the first frame as its WebP poster. */
export async function encodeSlot(slot: SlotName, ctx: CaptureContext): Promise<Encoded> {
  const dir = framesDir(ctx.cache, slot)
  const manifest = join(dir, 'clip.json')
  if (!existsSync(manifest))
    throw new Error(`E_MEDIA_NO_FRAMES ${slot}: run pnpm media:capture ${slot}`)
  const clip = JSON.parse(readFileSync(manifest, 'utf8')) as ClipInput
  const paths = slotPaths(slot)
  const target = (path: string) => join(ctx.root, 'public', path)
  mkdirSync(join(ctx.root, 'public', 'media', slot), { recursive: true })

  const encode = (codec: 'h264' | 'av1', path: string, budget: number) =>
    withinBudget(
      async (quality) => {
        ffmpeg(videoArgs(clip, codec, quality, target(path)))
        return statSync(target(path)).size
      },
      { start: START_QUALITY[codec], step: 2, last: START_QUALITY[codec] + 14, budget },
    )
  const webm = await encode('av1', paths.webm, slot === 'hero' ? HERO_BUDGET / 2.6 : CLIP_BUDGET)
  const mp4 = await encode(
    'h264',
    paths.mp4,
    slot === 'hero' ? HERO_BUDGET - webm.bytes : CLIP_BUDGET,
  )
  const encoded = mp4Info(readFileSync(target(paths.mp4)))
  if (encoded.width !== clip.width || encoded.height !== clip.height) {
    throw new Error(`E_MEDIA_ENCODE ${slot} is ${encoded.width}x${encoded.height}`)
  }
  const poster = await fitPoster(frameFile(clip.frames, 0), {
    width: clip.width,
    height: clip.height,
    maxBytes: POSTER_BUDGET,
  })
  writeFileSync(target(paths.poster), poster.data)
  const scene = SCENES[slot]
  return {
    slot,
    width: clip.width,
    height: clip.height,
    duration: Math.round((clip.count / clip.fps) * 100) / 100,
    edges: scene ? edgesOf(scene.clip, scene.viewport) : [],
    files: [
      { path: paths.mp4, ...mp4 },
      { path: paths.webm, ...webm },
      { path: paths.poster, bytes: poster.data.length, quality: poster.quality },
    ],
  }
}

export async function captureSlots(slots: SlotName[], ctx: CaptureContext): Promise<void> {
  await waitForQuietMachine(ctx.log)
  const symbols = new SymbolRenderer(join(ctx.cache, 'bin'))
  const browser = await launch(ctx.devotDir)
  try {
    for (const slot of slots) {
      const scene = SCENES[slot]
      if (!scene) throw new Error(`E_MEDIA_NO_SCENE ${slot}`)
      await captureScene(browser, scene, ctx, symbols)
    }
  } finally {
    symbols.stop()
    await browser.close()
  }
}
