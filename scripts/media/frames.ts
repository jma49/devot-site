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

export interface SmallText {
  size: number
  /** A few characters of it, for the log. */
  text: string
}

/**
 * The smallest text that shows inside each rect, in the page and in its frames (the Settings
 * window), shadow roots included: what a reader has to make out in the clip. Sizes are in points.
 * Captions set in capitals are left out: their letters stand as tall as lower case of 10 pt text.
 */
export async function smallestText(page: Page, rects: Rect[]): Promise<SmallText[]> {
  const found: SmallText[] = rects.map(() => ({ size: Infinity, text: '' }))
  for (const frame of page.frames()) {
    const offset =
      frame === page.mainFrame()
        ? { x: 0, y: 0 }
        : await frame.frameElement().then((element) => element.boundingBox())
    if (!offset) continue
    const local = rects.map((r) => ({ ...r, x: r.x - offset.x, y: r.y - offset.y }))
    const sizes = await frame.evaluate((areas) => {
      const least = areas.map(() => ({ size: Infinity, text: '' }))
      const visit = (root: Node) => {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        )
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node instanceof Element) {
            if (node.shadowRoot) visit(node.shadowRoot)
            continue
          }
          const parent = node.parentElement
          const text = node.textContent?.trim()
          if (!text || !parent) continue
          if (!parent.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
          const style = getComputedStyle(parent)
          if (style.textTransform === 'uppercase') continue
          const size = parseFloat(style.fontSize)
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const box of range.getClientRects()) {
            if (box.width < 1 || box.height < 1) continue
            areas.forEach((area, i) => {
              const inside =
                box.right > area.x &&
                box.left < area.x + area.width &&
                box.bottom > area.y &&
                box.top < area.y + area.height
              if (inside && size < least[i]!.size) least[i] = { size, text: text.slice(0, 24) }
            })
          }
        }
      }
      visit(document.body)
      return least
    }, local)
    sizes.forEach((small, i) => {
      if (small.size < found[i]!.size) found[i] = small
    })
  }
  return found
}

export interface Rendered {
  count: number
  /** The smallest text seen in each of `measure` over the whole clip. */
  minText: SmallText[]
}

/**
 * Renders a timeline frame by frame: before each frame the page gets the events due by then, the
 * pointer moves where the timeline puts it, the app's animations are set to the frame's time, and a
 * 2x screenshot of `clip` is taken. A live screencast gives 1x frames at 10 to 15 fps here; this
 * gives full resolution at an even pace, whatever a screenshot costs. With `sample`, only every
 * sample-th frame is written, to look at a scene while working on it.
 */
export async function renderFrames(
  page: Page,
  timeline: Timeline,
  options: {
    dir: string
    fps: number
    clip: Rect
    motion: boolean
    measure: Rect[]
    sample?: number
    log: (line: string) => void
  },
): Promise<Rendered> {
  const { dir, fps, clip, motion, measure, sample = 1, log } = options
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const events = [...timeline.events].sort((a, b) => a.at - b.at)
  const count = Math.round(timeline.duration * fps)
  const minText: SmallText[] = measure.map(() => ({ size: Infinity, text: '' }))
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
    if (frame % 15 === 0) {
      const found = await smallestText(page, measure)
      found.forEach((small, i) => {
        if (small.size < minText[i]!.size) minText[i] = small
      })
    }
    if (frame % sample === 0) {
      await page.screenshot({
        path: frameFile(dir, frame),
        clip,
        animations: motion ? 'allow' : 'disabled',
        caret: 'initial',
      })
    }
    if (frame % 60 === 0) {
      log(`frame ${frame}/${count} after ${((Date.now() - started) / 1000).toFixed(1)} s`)
    }
  }
  while (next < events.length) {
    await events[next]!.run()
    next++
  }
  return { count, minText }
}
