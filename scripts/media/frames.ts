import { mkdirSync, rmSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { frameFile } from './encode.ts'
import { drawCursor } from './overlay.ts'
import type { Actions, Timeline } from './timeline.ts'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function pageActions(page: Page): Actions {
  return {
    down: () => page.mouse.down(),
    up: () => page.mouse.up(),
    type: (text) => page.keyboard.type(text),
    press: (key) => page.keyboard.press(key),
  }
}

async function settled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30))),
      ),
  )
}

/**
 * Renders a timeline frame by frame: before each frame the page gets the events due by then, the
 * pointer moves where the timeline puts it, the app's animations are set to the frame's time, and a
 * 2x screenshot of `clip` is taken. A live screencast gives 1x frames at 10 to 15 fps here; this
 * gives full resolution at an even pace, whatever a screenshot costs.
 */
export async function renderFrames(
  page: Page,
  timeline: Timeline,
  options: { dir: string; fps: number; clip: Rect; motion: boolean; log: (line: string) => void },
): Promise<number> {
  const { dir, fps, clip, motion, log } = options
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const events = [...timeline.events].sort((a, b) => a.at - b.at)
  const count = Math.round(timeline.duration * fps)
  let next = 0
  const started = Date.now()
  for (let frame = 0; frame < count; frame++) {
    const t = frame / fps
    while (next < events.length && events[next]!.at <= t + 1e-9) {
      await events[next]!.run()
      next++
    }
    const cursor = timeline.cursor(t)
    await page.mouse.move(cursor.x, cursor.y)
    await drawCursor(page, cursor)
    await settled(page)
    if (motion) {
      await page.evaluate(
        (time) => (globalThis as unknown as { mediaClock(t: number): void }).mediaClock(time),
        t,
      )
    }
    await page.screenshot({
      path: frameFile(dir, frame),
      clip,
      animations: motion ? 'allow' : 'disabled',
      caret: 'initial',
    })
    if (frame % 60 === 0) {
      log(`frame ${frame}/${count} after ${((Date.now() - started) / 1000).toFixed(1)} s`)
    }
  }
  while (next < events.length) {
    await events[next]!.run()
    next++
  }
  return count
}
