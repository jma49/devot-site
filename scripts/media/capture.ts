import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { loadavg } from 'node:os'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import sharp from 'sharp'
import {
  slotPaths,
  variantName,
  type Measured,
  type Scheme,
  type SlotName,
} from '../../src/media.ts'
import { launch, openApp, SymbolRenderer } from './browser.ts'
import {
  cutFrame,
  ffmpeg,
  fitPoster,
  frameFile,
  posterFrame,
  START_QUALITY,
  videoArgs,
  withinBudget,
  type ClipInput,
  type PixelRect,
} from './encode.ts'
import { pageActions, renderFrames, type Rect } from './frames.ts'
import { edgesOf } from './manifest.ts'
import { mp4Info } from './mp4.ts'
import { installOverlay } from './overlay.ts'
import { frameRect, SCENES, type Scene } from './scenes.ts'
import { seedLibrary, VIEW } from './seed.ts'

export interface CaptureContext {
  root: string
  cache: string
  devotDir: string
  baseURL: string
  fps: number
  schemes: readonly Scheme[]
  /** Above 1, writes only every sample-th frame, to a folder of its own, to look at a scene. */
  sample: number
  log: (line: string) => void
}

const KB = 1024

/** Where a scene's frames go for one colour scheme; `sample` runs go elsewhere. */
export const framesDir = (cache: string, slot: SlotName, scheme: Scheme, sample = false) =>
  join(cache, 'frames', slot, sample ? `${scheme}-sample` : scheme)

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

/** What a capture leaves beside a scene's frames for the encoder: clip.json. */
export interface Captured extends ClipInput {
  posterTime: number
  /** The smallest text in the clip and in the phone cut, in points. */
  minText: number
  phoneMinText?: number
}

async function captureScene(
  browser: Browser,
  scene: Scene,
  scheme: Scheme,
  ctx: CaptureContext,
  symbols: SymbolRenderer,
) {
  const { context, page, problems } = await openApp(browser, {
    baseURL: ctx.baseURL,
    devotDir: ctx.devotDir,
    symbols,
    scheme,
    viewport: scene.viewport,
    settings: { sidebarMaterial: false, theme: 'tide', ...scene.settings },
    motion: scene.motion,
  })
  const label = `${scene.slot} ${scheme}`
  try {
    await page.goto('/')
    await page.locator('.window[data-ready]').waitFor()
    await seedLibrary(page, ctx.devotDir, { ...VIEW, ...scene.view })
    await scene.prepare(page)
    await installOverlay(page)
    const timeline = await scene.script(page, pageActions(page))
    const dir = framesDir(ctx.cache, scene.slot, scheme, ctx.sample > 1)
    const rendered = await renderFrames(page, timeline, {
      dir,
      fps: ctx.fps,
      clip: frameRect(scene),
      motion: scene.motion,
      measure: scene.phone ? [scene.clip, scene.phone.rect] : [scene.clip],
      sample: ctx.sample,
      log: (line) => ctx.log(`${label} ${line}`),
    })
    await scene.check?.(page)
    const alerts = await page
      .locator('[role="alert"]:visible, .toast:visible, .island-error:visible')
      .count()
    if (problems.length > 0 || alerts > 0) {
      throw new Error(`E_MEDIA_PAGE ${label}: ${alerts} alerts; ${problems.join(' | ')}`)
    }
    const [smallest, phoneSmallest] = rendered.minText
    const captured: Captured = {
      frames: dir,
      count: rendered.count,
      fps: ctx.fps,
      fade: scene.fade,
      width: scene.output.width,
      height: scene.output.height,
      posterTime: timeline.posterTime,
      minText: smallest?.size ?? Infinity,
      ...(phoneSmallest && { phoneMinText: phoneSmallest.size }),
    }
    writeFileSync(join(dir, 'clip.json'), JSON.stringify(captured))
    ctx.log(
      `${label} ${rendered.count} frames, ${(rendered.count / ctx.fps).toFixed(2)} s, ` +
        `poster at ${timeline.posterTime.toFixed(2)} s, smallest text ` +
        rendered.minText.map(({ size, text }) => `${size} pt "${text}"`).join(', '),
    )
  } finally {
    await context.close()
  }
}

export interface Encoded {
  slot: SlotName
  measured: Measured
  files: { path: string; bytes: number; quality: number }[]
}

/** Under the limits in tests/unit/media.test.ts, with room to spare. */
const LIMITS = {
  // The hero's poster is its largest paint, a full window of text at twice its points.
  hero: { clip: 980 * KB, poster: 118 * KB },
  heroPhone: { clip: 395 * KB, poster: 48 * KB },
  clip: { clip: 600 * KB, poster: 78 * KB },
  phone: { clip: 600 * KB, poster: 48 * KB },
}

/** Frame pixels of a rect in window points, inside frames captured at 2x from `frames`. */
const inFrame = (rect: Rect, frames: Rect): PixelRect => ({
  x: (rect.x - frames.x) * 2,
  y: (rect.y - frames.y) * 2,
  width: rect.width * 2,
  height: rect.height * 2,
})

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

async function colourAt(png: string, x: number, y: number): Promise<string> {
  const data = await sharp(png)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer()
  return [...data].map((value) => value.toString(16).padStart(2, '0')).join('')
}

/**
 * Each variant of a slot within its budget: MP4 (H.264) and WebM (AV1), and the frame at the
 * scene's poster time as a WebP poster. The phone variant is cut from the same frames.
 */
export async function encodeSlot(slot: SlotName, ctx: CaptureContext): Promise<Encoded> {
  const scene = SCENES[slot]
  if (!scene) throw new Error(`E_MEDIA_NO_SCENE ${slot}`)
  const target = (path: string) => join(ctx.root, 'public', path)
  mkdirSync(join(ctx.root, 'public', 'media', slot), { recursive: true })
  const files: Encoded['files'] = []
  const bytes: Measured['bytes'] = {}
  let captured: Captured | undefined
  for (const scheme of ctx.schemes) {
    const dir = framesDir(ctx.cache, slot, scheme)
    const manifest = join(dir, 'clip.json')
    if (!existsSync(manifest))
      throw new Error(`E_MEDIA_NO_FRAMES ${slot} ${scheme}: run pnpm media:capture ${slot}`)
    const run = JSON.parse(readFileSync(manifest, 'utf8')) as Captured
    captured = run
    const frames = frameRect(scene)
    const whole: ClipInput = sameRect(frames, scene.clip)
      ? run
      : { ...run, crop: inFrame(scene.clip, frames) }
    const variants: { phone: boolean; clip: ClipInput }[] = [{ phone: false, clip: whole }]
    if (scene.phone) {
      const { rect, output, fill } = scene.phone
      const pixels = inFrame(rect, frames)
      const edge = { x: pixels.x + pixels.width - 2, y: pixels.y + pixels.height - 2 }
      const cut = fill
        ? { fill: { rect: pixels, color: await colourAt(frameFile(dir, 0), edge.x, edge.y) } }
        : { crop: pixels }
      variants.push({ phone: true, clip: { ...run, ...output, ...cut } })
    }
    for (const { phone, clip } of variants) {
      const paths = slotPaths(slot, { scheme, phone })
      const hero = slot === 'hero'
      const limits = hero
        ? phone
          ? LIMITS.heroPhone
          : LIMITS.hero
        : phone
          ? LIMITS.phone
          : LIMITS.clip
      const encode = async (codec: 'h264' | 'av1', path: string) => {
        const result = await withinBudget(
          async (quality) => {
            ffmpeg(videoArgs(clip, codec, quality, target(path)))
            return statSync(target(path)).size
          },
          {
            start: START_QUALITY[codec],
            step: 2,
            last: START_QUALITY[codec] + 14,
            budget: limits.clip,
          },
        )
        files.push({ path, ...result })
        return result.bytes
      }
      const webm = await encode('av1', paths.webm)
      const mp4 = await encode('h264', paths.mp4)
      const encoded = mp4Info(readFileSync(target(paths.mp4)))
      if (encoded.width !== clip.width || encoded.height !== clip.height) {
        throw new Error(`E_MEDIA_ENCODE ${paths.mp4} is ${encoded.width}x${encoded.height}`)
      }
      const frame = frameFile(clip.frames, posterFrame(clip, run.posterTime))
      const poster = await fitPoster(await cutFrame(frame, clip), {
        width: clip.width,
        height: clip.height,
        maxBytes: limits.poster,
      })
      writeFileSync(target(paths.poster), poster.data)
      files.push({ path: paths.poster, bytes: poster.data.length, quality: poster.quality })
      bytes[variantName({ scheme, phone })] = { mp4, webm, poster: poster.data.length }
    }
  }
  if (!captured) throw new Error(`E_MEDIA_NO_SCHEME ${slot}`)
  const { phone } = scene
  const measured: Measured = {
    width: scene.output.width,
    height: scene.output.height,
    points: scene.clip.width,
    minText: captured.minText,
    duration: Math.round((captured.count / captured.fps) * 100) / 100,
    posterTime: Math.round(captured.posterTime * 100) / 100,
    edges: edgesOf(scene.clip, scene.viewport),
    ...(phone && {
      phone: {
        ...phone.output,
        points: phone.fill ? scene.clip.width : phone.rect.width,
        minText: (!phone.fill && captured.phoneMinText) || captured.minText,
      },
    }),
    bytes,
  }
  return { slot, measured, files }
}

export async function captureSlots(slots: SlotName[], ctx: CaptureContext): Promise<void> {
  await waitForQuietMachine(ctx.log)
  const symbols = new SymbolRenderer(join(ctx.cache, 'bin'))
  const browser = await launch(ctx.devotDir)
  try {
    for (const slot of slots) {
      const scene = SCENES[slot]
      if (!scene) throw new Error(`E_MEDIA_NO_SCENE ${slot}`)
      for (const scheme of ctx.schemes) await captureScene(browser, scene, scheme, ctx, symbols)
    }
  } finally {
    symbols.stop()
    await browser.close()
  }
}
