import type { Page } from '@playwright/test'
import { REDUCED_FLOW } from '../../src/scripts/hero-backdrop.ts'
import { PAUSE_KEY } from '../../src/scripts/pause.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1024, height: 700 }
const PHONE = { width: 390, height: 844 }
const GPU = 'Test GPU'
const SOFTWARE = 'Google SwiftShader'
/** The Sage band's sway, the shorter of the two, in milliseconds (aurora.css). */
const SWAY = 36_000

interface Draw {
  /** `performance.now()` at the draw. */
  at: number
  /** The flow time the shader drew. */
  flow: number
}

/**
 * Counts WebGL contexts and draws and keeps each draw's flow time (the last `uniform1f` before
 * it), and names the renderer `renderer`: headless Chromium draws on SwiftShader, which the page
 * rightly refuses, so the WebGL tests name a GPU.
 */
async function watchWebgl(page: Page, renderer: string) {
  await page.addInitScript((name) => {
    const record = window as unknown as { glContexts: number; glDraws: Draw[] }
    record.glContexts = 0
    record.glDraws = []
    const proto = WebGLRenderingContext.prototype
    const { getParameter, uniform1f, drawArrays } = proto
    const getContext = HTMLCanvasElement.prototype.getContext
    let last = Number.NaN
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<HTMLCanvasElement['getContext']>
    ) {
      if (args[0] === 'webgl') record.glContexts += 1
      return getContext.apply(this, args)
    } as typeof getContext
    proto.getParameter = function (this: WebGLRenderingContext, parameter: number) {
      // UNMASKED_RENDERER_WEBGL from WEBGL_debug_renderer_info.
      return parameter === 0x9246 ? name : getParameter.call(this, parameter)
    }
    proto.uniform1f = function (this: WebGLRenderingContext, location, value) {
      last = value
      uniform1f.call(this, location, value)
    }
    proto.drawArrays = function (this: WebGLRenderingContext, ...args) {
      record.glDraws.push({ at: performance.now(), flow: last })
      drawArrays.apply(this, args)
    }
  }, renderer)
}

const draws = (page: Page) =>
  page.evaluate(() => (window as unknown as { glDraws: Draw[] }).glDraws.slice())
const contexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { glContexts: number }).glContexts)
const hero = (page: Page) => page.locator('[data-hero]')

/** Runs the page's fake clock a tenth of a second at a time until `check` holds. */
async function advanceUntil(page: Page, check: () => Promise<boolean>, limit = 20_000) {
  for (let ran = 0; !(await check()); ran += 100) {
    if (ran > limit) throw new Error(`E_NEVER_SETTLED after ${limit} ms of page time`)
    await page.clock.runFor(100)
  }
}

const backdropIs = (page: Page, kind: 'webgl' | 'css') => () =>
  hero(page).evaluate((element, expected) => element.dataset['backdrop'] === expected, kind)

/** The flow time the shader advances per second of page time, between the first and last draw. */
function flowPerSecond(seen: Draw[]): number {
  const first = seen[0]
  const last = seen.at(-1)
  if (!first || !last || last.at === first.at) return Number.NaN
  return (last.flow - first.flow) / ((last.at - first.at) / 1000)
}

/** The play state of every drifting CSS band, the hero's and the closing section's. */
const swayStates = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a instanceof CSSAnimation && a.animationName.startsWith('aurora-sway'))
      .map((a) => ({
        state: a.playState,
        duration: Number((a.effect as KeyframeEffect).getTiming().duration),
      })),
  )

/** Presses the pause toggle through the DOM, whether or not this layout shows it. */
const togglePause = (page: Page) =>
  page
    .locator('[data-motion-toggle]')
    .first()
    .evaluate((button: HTMLButtonElement) => {
      button.click()
    })

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  const rate = reducedMotion === 'reduce' ? REDUCED_FLOW : 1
  const slowdown = reducedMotion === 'reduce' ? 3 : 1

  test.describe(`WebGL aurora, reduced motion ${reducedMotion}`, () => {
    test.use({ viewport: DESKTOP })

    test.beforeEach(async ({ page }) => {
      await page.clock.install()
      await watchWebgl(page, GPU)
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')
      await advanceUntil(page, backdropIs(page, 'webgl'))
      // From here only runFor moves the clock: real time running on beside it lets a busy machine
      // put draws closer than the frames that timed them.
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500)
    })

    test(`drifts at ${rate === 1 ? 'full' : 'a third of its'} pace, 30 frames a second`, async ({
      page,
    }) => {
      const start = (await draws(page)).length
      await page.clock.runFor(3000)

      const seen = (await draws(page)).slice(start)
      await expect(hero(page)).toHaveAttribute('data-backdrop', 'webgl')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      const gaps = seen.slice(1).map((draw, index) => draw.at - (seen[index]?.at ?? 0))
      expect(seen.length).toBeGreaterThanOrEqual(80)
      // The fake clock's frames come every 16 ms, so every second one is drawn.
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1000 / 30 - 2)
      expect(flowPerSecond(seen)).toBeCloseTo(rate, 1)
    })

    test('stops drawing while paused and starts again', async ({ page }) => {
      await togglePause(page)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      const held = (await draws(page)).length
      await page.clock.runFor(2000)
      expect(await draws(page)).toHaveLength(held)

      await togglePause(page)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      await page.clock.runFor(1000)
      const seen = await draws(page)
      const resumed = seen.slice(held)
      expect(resumed.length).toBeGreaterThan(20)
      expect(flowPerSecond(resumed)).toBeCloseTo(rate, 1)
      // The flow picks up where it stopped instead of jumping by the paused two seconds.
      expect((resumed[0]?.flow ?? Infinity) - (seen[held - 1]?.flow ?? 0)).toBeLessThan(0.1)
    })
  })

  test.describe(`CSS aurora, reduced motion ${reducedMotion}`, () => {
    test.use({ viewport: PHONE })

    test(`sways ${slowdown === 1 ? 'at its pace' : 'three times slower'}, and holds still while paused`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      await expect(hero(page)).toHaveAttribute('data-backdrop', 'css')
      await expect(page.locator('html')).not.toHaveAttribute('data-aurora-still')

      const running = await swayStates(page)
      // Two bands in the hero's aurora and two in the closing section's, each in two appearances.
      expect(running.filter(({ state }) => state === 'running').length).toBeGreaterThanOrEqual(4)
      expect(Math.min(...running.map(({ duration }) => duration))).toBe(SWAY * slowdown)

      await togglePause(page)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      expect((await swayStates(page)).filter(({ state }) => state === 'running')).toEqual([])

      await togglePause(page)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      await expect
        .poll(async () => (await swayStates(page)).filter(({ state }) => state === 'running'))
        .not.toEqual([])
    })

    test('stays still from the first paint when the pause was chosen before', async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), PAUSE_KEY)
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')

      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      expect((await swayStates(page)).filter(({ state }) => state === 'running')).toEqual([])
    })
  })
}

test.describe('WebGL aurora on a slow or software renderer', () => {
  test.use({ viewport: DESKTOP })

  // A software GPU process spends a whole core compositing the drifting CSS bands.
  test('keeps the CSS aurora still on a software renderer', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, SOFTWARE)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, async () => (await contexts(page)) > 0)
    await page.clock.runFor(2000)
    await expect(hero(page)).toHaveAttribute('data-backdrop', 'css')
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
    expect(await draws(page)).toEqual([])
    await expect(page.locator('.hero-canvas')).toHaveCSS('opacity', '0')
    await expect(page.locator('html')).toHaveAttribute('data-aurora-still', '')
    const bands = await swayStates(page)
    expect(bands.length).toBeGreaterThanOrEqual(4)
    expect(bands.filter(({ state }) => state === 'running')).toEqual([])
  })

  test('hands back to the CSS aurora when its first frames come 32 ms apart', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    // Frames reach the page twice as far apart as the fake clock's 16 ms.
    await page.addInitScript(() => {
      const request = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) => request((now) => callback(now * 2))
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, async () => (await draws(page)).length > 0)
    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
    const held = (await draws(page)).length
    await page.clock.runFor(1000)
    expect(await draws(page)).toHaveLength(held)
    expect(
      (await swayStates(page)).filter(({ state }) => state === 'running').length,
    ).toBeGreaterThan(0)
  })
})
