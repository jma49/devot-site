import type { Page } from '@playwright/test'
import { DURATION } from '../../src/lib/motion.ts'
import { HERO_SKY, REDUCED_FLOW } from '../../src/scripts/hero-backdrop.ts'
import { HERO_SCROLL } from '../../src/scripts/hero.ts'
import { PAUSE_KEY } from '../../src/scripts/pause.ts'
import { expect, test } from './fixtures.ts'

const DESKTOP = { width: 1024, height: 700 }
const PHONE = { width: 390, height: 844 }
const GPU = 'Test GPU'
const SOFTWARE = 'Google SwiftShader'
/** The Sage band's sway, the shorter of the two, in milliseconds (aurora.css). */
const SWAY = 12_000

interface Draw {
  /** `performance.now()` at the draw. */
  at: number
  /** Which frame the draw belongs to: a frame sets the flow time once, then draws once or twice. */
  frame: number
  /** The flow time the shader drew. */
  flow: number
  /** 1 for the soft sky behind the page under its veil, 0 for the hero's. */
  soft: number
  /** The canvas rows drawn, top to bottom. */
  rows: [number, number]
  /** The row of the sky's own box at the top of the canvas, and the scale it is drawn at. */
  rise: number
  zoom: number
  /** The opacity of the dome over the hero's sky. */
  dome: number
  /** The rows over which the draw thins out; past the canvas for a whole one. */
  fade: [number, number]
  /** The canvas's height in rows. */
  height: number
}

/**
 * Counts WebGL contexts and draws and keeps what each draw was given (the uniforms and the
 * scissor set before it), and names the renderer `renderer`: headless Chromium draws on
 * SwiftShader, which the page rightly refuses, so the WebGL tests name a GPU.
 */
async function watchWebgl(page: Page, renderer: string) {
  await page.addInitScript((name) => {
    const record = window as unknown as { glContexts: number; glDraws: Draw[] }
    record.glContexts = 0
    record.glDraws = []
    const proto = WebGLRenderingContext.prototype
    const { getParameter, getUniformLocation, uniform1f, uniform2f, uniform3f, scissor } = proto
    const { drawArrays } = proto
    const getContext = HTMLCanvasElement.prototype.getContext
    const names = new WeakMap<WebGLUniformLocation, string>()
    const set: Record<string, number[]> = {}
    let rows: [number, number] = [0, 0]
    let frame = 0
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
    proto.getUniformLocation = function (this: WebGLRenderingContext, program, uniform) {
      const location = getUniformLocation.call(this, program, uniform)
      if (location) names.set(location, uniform)
      return location
    }
    const keep = (location: WebGLUniformLocation | null, values: number[]) => {
      const uniform = location ? names.get(location) : undefined
      if (uniform) set[uniform] = values
      if (uniform === 'uTime') frame += 1
    }
    proto.uniform1f = function (this: WebGLRenderingContext, location, x) {
      keep(location, [x])
      uniform1f.call(this, location, x)
    }
    proto.uniform2f = function (this: WebGLRenderingContext, location, x, y) {
      keep(location, [x, y])
      uniform2f.call(this, location, x, y)
    }
    proto.uniform3f = function (this: WebGLRenderingContext, location, x, y, z) {
      keep(location, [x, y, z])
      uniform3f.call(this, location, x, y, z)
    }
    proto.scissor = function (this: WebGLRenderingContext, x, y, width, height) {
      const top = this.drawingBufferHeight - y - height
      rows = [top, top + height]
      scissor.call(this, x, y, width, height)
    }
    proto.drawArrays = function (this: WebGLRenderingContext, ...args) {
      const one = (uniform: string, at = 0) => set[uniform]?.[at] ?? Number.NaN
      record.glDraws.push({
        at: performance.now(),
        frame,
        flow: one('uTime'),
        soft: one('uSoft'),
        rows,
        rise: one('uRise'),
        zoom: one('uZoom'),
        dome: one('uDome', 2),
        fade: [one('uFade'), one('uFade', 1)],
        height: this.drawingBufferHeight,
      })
      drawArrays.apply(this, args)
    }
  }, renderer)
}

/** The draws so far, from the `start`th on. */
const draws = (page: Page, start = 0) =>
  page.evaluate((from) => (window as unknown as { glDraws: Draw[] }).glDraws.slice(from), start)
const drawCount = (page: Page) =>
  page.evaluate(() => (window as unknown as { glDraws: Draw[] }).glDraws.length)
const contexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { glContexts: number }).glContexts)
/** The draws of the last frame drawn: one for the sky behind the page, the hero's, or both. */
const lastFrame = (page: Page) =>
  page.evaluate(() => {
    const seen = (window as unknown as { glDraws: Draw[] }).glDraws
    return seen.slice(-2).filter(({ frame }) => frame === seen.at(-1)?.frame)
  })
/** Whether the last frame drew only the hero's sky (`0`) or only the page's (`1`), whole. */
const drawsOnly = (page: Page, soft: 0 | 1) => async () => {
  const frame = await lastFrame(page)
  const [draw] = frame
  return (
    frame.length === 1 &&
    draw?.soft === soft &&
    draw.rows[0] === 0 &&
    draw.rows[1] === draw.height &&
    draw.fade[0] >= draw.height
  )
}
/**
 * Takes KHR_parallel_shader_compile away, as in Safari, which builds a shader on the main
 * thread. The page must draw the same one sky there.
 */
async function buildOnMainThread(page: Page) {
  await page.addInitScript(() => {
    const proto = WebGLRenderingContext.prototype
    const getExtension = proto.getExtension as (
      this: WebGLRenderingContext,
      name: string,
    ) => unknown
    proto.getExtension = function (this: WebGLRenderingContext, name: string) {
      return name === 'KHR_parallel_shader_compile' ? null : getExtension.call(this, name)
    } as typeof proto.getExtension
  })
}

const hero = (page: Page) => page.locator('[data-hero]')
const sky = (page: Page) => page.locator('[data-page-sky]')
const canvas = (page: Page) => page.locator('.page-sky__canvas')

/** Runs the page's fake clock a tenth of a second at a time until `check` holds. */
async function advanceUntil(page: Page, check: () => Promise<boolean>, limit = 20_000) {
  for (let ran = 0; !(await check()); ran += 100) {
    if (ran > limit) throw new Error(`E_NEVER_SETTLED after ${limit} ms of page time`)
    await page.clock.runFor(100)
  }
}

/**
 * Pauses the fake clock half a second ahead of the page's time. That time runs on in real time until
 * then, so on a busy machine the target can pass first; it is read again and the pause retried.
 */
async function pauseSoon(page: Page) {
  for (let tries = 1; ; tries++) {
    const now = await page.evaluate(() => Date.now())
    try {
      return await page.clock.pauseAt(now + 500)
    } catch (error) {
      if (tries === 5 || !String(error).includes('past')) throw error
    }
  }
}

/** Whether the sky and the hero both say the shader, or the CSS aurora, shows. */
const backdropIs = (page: Page, kind: 'webgl' | 'css') => () =>
  page.evaluate(
    (expected) =>
      [...document.querySelectorAll<HTMLElement>('[data-page-sky], [data-hero]')].every(
        (element) => element.dataset['backdrop'] === expected,
      ),
    kind,
  )

/** Waits until the hero's sky has entered: until then the shader draws every frame to follow it. */
const entered = (page: Page) =>
  page.waitForFunction(() =>
    (document.querySelector('.hero-sky')?.getAnimations() ?? []).every(
      (animation) => !(animation instanceof CSSAnimation) || animation.playState !== 'running',
    ),
  )

const scrollIntoView = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => element.scrollIntoView())

/** The flow time the shader advances per second of page time, between the first and last draw. */
function flowPerSecond(seen: Draw[]): number {
  const first = seen[0]
  const last = seen.at(-1)
  if (!first || !last || last.at === first.at) return Number.NaN
  return (last.flow - first.flow) / ((last.at - first.at) / 1000)
}

/** The play state of every drifting CSS band: the hero's, the page sky's and the closing section's. */
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
      await entered(page)
      // From here only runFor moves the clock: real time running on beside it lets a busy machine
      // put draws closer than the frames that timed them.
      await pauseSoon(page)
    })

    test(`drifts at ${rate === 1 ? 'full' : 'a third of its'} pace, 30 frames a second`, async ({
      page,
    }) => {
      await page.clock.runFor(200)
      const start = await drawCount(page)
      await page.clock.runFor(3000)

      const seen = await draws(page, start)
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      const gaps = seen.slice(1).map((draw, index) => draw.at - (seen[index]?.at ?? 0))
      expect(seen.length).toBeGreaterThanOrEqual(80)
      // The fake clock's frames come every 16 ms, so every second one is drawn.
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1000 / 30 - 2)
      expect(flowPerSecond(seen)).toBeCloseTo(rate, 1)
      // At the top of the page the hero's sky is all there is to draw.
      expect(await drawsOnly(page, 0)()).toBe(true)
      expect(new Set(seen.map(({ soft }) => soft))).toEqual(new Set([0]))
    })

    test('stops drawing while paused and starts again', async ({ page }) => {
      await page.clock.runFor(200)
      await togglePause(page)
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'idle')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      const held = await drawCount(page)
      await page.clock.runFor(2000)
      expect(await drawCount(page)).toBe(held)

      await togglePause(page)
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      await page.clock.runFor(1000)
      const [last, ...resumed] = await draws(page, held - 1)
      expect(resumed.length).toBeGreaterThan(20)
      expect(flowPerSecond(resumed)).toBeCloseTo(rate, 1)
      // The flow picks up where it stopped instead of jumping by the paused two seconds.
      expect((resumed[0]?.flow ?? Infinity) - (last?.flow ?? 0)).toBeLessThan(0.1)
    })

    test(`lays the hero's sky out in the hero, ${rate === 1 ? 'trailing the page' : 'moving with the page'}`, async ({
      page,
    }) => {
      await page.clock.resume()
      const scale = (await canvas(page).evaluate((c: HTMLCanvasElement) => c.width)) / DESKTOP.width
      const height = await hero(page).evaluate((element: HTMLElement) => element.offsetHeight)
      await page.evaluate(() => window.scrollTo(0, 200))
      // With reduced motion nothing trails the scroll: the sky moves as the hero does.
      const trail = reducedMotion === 'reduce' ? 0 : HERO_SCROLL.skyRate * 200
      await advanceUntil(
        page,
        async () =>
          Math.abs(((await lastFrame(page))[0]?.rise ?? 0) - scale * (200 - trail)) < 0.01,
      )
      const [draw] = await lastFrame(page)
      expect(draw).toMatchObject({ soft: 0, zoom: 1, rows: [0, draw?.height] })
      // The dome under the window is the shader's too: it rises once the page has scrolled.
      expect(draw?.dome).toBe(reducedMotion === 'reduce' ? 0 : 1)
      await expect(page.locator('.hero-dome')).toHaveCSS('opacity', '0')
      expect(scale * height).toBeGreaterThan(draw?.height ?? Infinity)
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
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
      expect(await backdropIs(page, 'css')()).toBe(true)
      await expect(page.locator('html')).not.toHaveAttribute('data-aurora-still')

      const running = await swayStates(page)
      // Two bands each in the hero's aurora, the page sky's and the closing section's.
      expect(running.filter(({ state }) => state === 'running').length).toBeGreaterThanOrEqual(4)
      expect(Math.min(...running.map(({ duration }) => duration))).toBe(SWAY * slowdown)

      await togglePause(page)
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'idle')
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
    expect(await backdropIs(page, 'css')()).toBe(true)
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
    expect(await drawCount(page)).toBe(0)
    await expect(canvas(page)).toHaveCSS('opacity', '0')
    await expect(page.locator('.hero-sky')).toHaveCSS('visibility', 'visible')
    await expect(page.locator('html')).toHaveAttribute('data-aurora-still', '')
    const bands = await swayStates(page)
    expect(bands.length).toBeGreaterThanOrEqual(4)
    expect(bands.filter(({ state }) => state === 'running')).toEqual([])

    // Nor behind the sections: the one context it tried is the only one.
    await scrollIntoView(page, '#pricing')
    await page.clock.runFor(1000)
    expect(await contexts(page)).toBe(1)
    expect(await backdropIs(page, 'css')()).toBe(true)
    expect(await drawCount(page)).toBe(0)
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

    await advanceUntil(page, async () => (await drawCount(page)) > 0)
    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
    const held = await drawCount(page)
    await page.clock.runFor(1000)
    expect(await drawCount(page)).toBe(held)
    expect(
      (await swayStates(page)).filter(({ state }) => state === 'running').length,
    ).toBeGreaterThan(0)
  })

  test('does not judge the GPU by frames the page scrolls in, or the ones just after', async ({
    page,
  }) => {
    test.slow()
    await page.clock.install()
    await watchWebgl(page, GPU)
    // Frames reach the page twice as far apart as the fake clock's 16 ms, and the page scrolls
    // in steps while `scrolling` is set.
    await page.addInitScript(() => {
      const state = window as unknown as { scrolling: boolean }
      state.scrolling = true
      const request = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) =>
        request((now) => {
          // Every tenth frame, as a wheel moves the page in steps.
          if (state.scrolling && Math.round(now / 16) % 10 === 0) {
            window.scrollBy(0, window.scrollY < 200 ? 20 : -200)
          }
          callback(now * 2)
        })
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, backdropIs(page, 'webgl'))
    // Twice the frames the check reads.
    await page.clock.runFor(2500)
    expect(await backdropIs(page, 'webgl')()).toBe(true)

    // At rest the same frames show a GPU that cannot keep up.
    await page.evaluate(() => {
      ;(window as unknown as { scrolling: boolean }).scrolling = false
    })
    await advanceUntil(page, backdropIs(page, 'css'))
  })

  // A software GL draws on at a few frames a second through a whole scroll.
  test('hands back even while the page scrolls when frames come 64 ms apart', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await page.addInitScript(() => {
      const request = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) =>
        request((now) => {
          if (Math.round(now / 16) % 10 === 0) window.scrollBy(0, window.scrollY < 200 ? 20 : -200)
          callback(now * 4)
        })
    })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, async () => (await drawCount(page)) > 0)
    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
  })

  for (const where of ['over the hero', 'behind a section'] as const) {
    test(`hands back to the CSS aurora at once, without fading, when the GPU drops its context ${where}`, async ({
      page,
      problems,
    }) => {
      await page.clock.install()
      await watchWebgl(page, GPU)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await advanceUntil(page, backdropIs(page, 'webgl'))
      if (where === 'behind a section') {
        await scrollIntoView(page, '#pricing')
        await advanceUntil(page, drawsOnly(page, 1))
      }

      await canvas(page).evaluate((element: HTMLCanvasElement) => {
        element.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext()
      })
      await advanceUntil(page, backdropIs(page, 'css'))
      // A canvas without its context is blank: it goes at once and does not fade out, and the
      // hero's CSS sky is back over it as fast.
      await expect(canvas(page)).toHaveCSS('transition-duration', '0s')
      await expect(canvas(page)).toHaveCSS('opacity', '0')
      for (const part of ['.hero-sky', '.hero-grain', '.hero-dome']) {
        await expect(page.locator(part)).toHaveCSS('transition-duration', '0s')
        await expect(page.locator(part)).toHaveCSS('visibility', 'visible')
      }
      await expect(page.locator('.hero-sky')).toHaveCSS('opacity', '1')
      const held = await drawCount(page)
      await page.clock.runFor(1000)
      expect(await drawCount(page)).toBe(held)
      expect(
        (await swayStates(page)).filter(({ state }) => state === 'running').length,
      ).toBeGreaterThan(0)
      // WebKit logs every lost context, this deliberate one too.
      const logged = problems.filter((text) => text !== 'WebGL: context lost.')
      problems.splice(0, problems.length, ...logged)
    })
  }
})

// One shader on one canvas, fixed to the window behind the whole page, draws the hero's sky where
// the hero is and its soft form under the veil behind everything after it.
for (const build of ['beside the main thread', 'on the main thread, as in Safari'] as const) {
  test.describe(`one WebGL sky for the whole page, its shader built ${build}`, () => {
    test.use({ viewport: DESKTOP })

    test.beforeEach(async ({ page }) => {
      await page.clock.install()
      await watchWebgl(page, GPU)
      if (build !== 'beside the main thread') await buildOnMainThread(page)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      await advanceUntil(page, backdropIs(page, 'webgl'))
    })

    test('shows the hero the canvas behind the page in place of its own CSS sky', async ({
      page,
    }) => {
      await expect(page.locator('canvas')).toHaveCount(1)
      await expect(canvas(page)).toHaveCSS('opacity', '1')
      await expect(canvas(page)).not.toHaveCSS('transition-duration', '0s')
      await advanceUntil(page, drawsOnly(page, 0))
      await expect(page.locator('.hero-backdrop')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      // The CSS sky fades out only once the canvas under it has faded in.
      const delays = await page
        .locator('.hero-sky')
        .evaluate((element) => getComputedStyle(element).transitionDelay.split(', '))
      expect(delays.map(Number.parseFloat)).toEqual([DURATION.media / 1000, 1.4])
      for (const part of ['.hero-sky', '.hero-grain', '.hero-dome']) {
        await expect(page.locator(part)).toHaveCSS('visibility', 'hidden')
      }
      await expect(page.locator('.hero-sheen')).toHaveCSS('visibility', 'visible')
      await expect(page.locator('html')).not.toHaveAttribute('data-aurora-still')
    })

    test('flows soft behind every section, on the one context, and gives the hero its sky back', async ({
      page,
    }) => {
      test.slow()
      for (const section of ['#cards', '#iphone', '#pricing']) {
        await scrollIntoView(page, section)
        await advanceUntil(page, drawsOnly(page, 1))
        expect(await backdropIs(page, 'webgl')(), section).toBe(true)
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await advanceUntil(page, drawsOnly(page, 1))
      expect(await contexts(page)).toBe(1)
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
      await expect(page.locator('.page-sky [data-aurora="dark"] .aurora-band').first()).toHaveCSS(
        'visibility',
        'hidden',
      )

      // Laid out in the window, so it never moves with the scroll, at the hero's pace.
      await pauseSoon(page)
      await page.clock.runFor(200)
      const start = await drawCount(page)
      await page.clock.runFor(3000)
      const seen = await draws(page, start)
      expect(seen.length).toBeGreaterThanOrEqual(80)
      expect(flowPerSecond(seen)).toBeCloseTo(1, 1)
      for (const draw of seen) {
        expect(draw).toMatchObject({ soft: 1, rise: 0, zoom: 1, rows: [0, draw.height] })
      }

      await page.clock.resume()
      await page.evaluate(() => window.scrollTo(0, 0))
      await advanceUntil(page, drawsOnly(page, 0))
      await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
      expect(await contexts(page)).toBe(1)
    })

    test('lets the hero’s sky thin out into the page’s across the hero’s lower edge', async ({
      page,
    }) => {
      const scale = (await canvas(page).evaluate((c: HTMLCanvasElement) => c.width)) / DESKTOP.width
      await page.evaluate(() => {
        const box = document.querySelector('[data-hero]')!.getBoundingClientRect()
        window.scrollTo(0, window.scrollY + box.bottom - innerHeight / 2)
      })
      await advanceUntil(page, async () => (await lastFrame(page)).length === 2)

      const [behind, over] = await lastFrame(page)
      const box = await hero(page).evaluate((element) => {
        const { bottom, height } = element.getBoundingClientRect()
        return { bottom, height }
      })
      const edge = scale * box.bottom
      const start = edge - scale * box.height * HERO_SKY.fade
      // WebKit scrolls by whole pixels, so the edge may stand a fraction off the middle.
      expect(Math.abs(box.bottom - DESKTOP.height / 2)).toBeLessThan(1)
      // The page's sky first, from where the hero's begins to thin out; the hero's over it.
      expect(behind).toMatchObject({ soft: 1, rise: 0, rows: [Math.floor(start), behind?.height] })
      expect(over).toMatchObject({ soft: 0, rows: [0, Math.ceil(edge)] })
      expect(over?.fade[0]).toBeCloseTo(start, 2)
      expect(over?.fade[1]).toBeCloseTo(edge, 2)
    })

    test('keeps to the scroll while the reader has paused it', async ({ page }) => {
      await advanceUntil(page, drawsOnly(page, 0))
      await togglePause(page)
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'idle')
      const before = (await lastFrame(page))[0]?.flow ?? Number.NaN

      // Under a section the sky must not keep the strength it has over the hero.
      await scrollIntoView(page, '#pricing')
      await advanceUntil(page, drawsOnly(page, 1))
      // The flow stands where the pause caught it, at most the frames since the last draw on.
      const flow = (await lastFrame(page))[0]?.flow ?? Number.NaN
      expect(flow - before).toBeGreaterThanOrEqual(0)
      expect(flow - before).toBeLessThan(0.1)
      await page.clock.runFor(1000)
      const held = await drawCount(page)
      await page.clock.runFor(2000)
      expect(await drawCount(page)).toBe(held)

      await page.evaluate(() => window.scrollTo(0, 0))
      await advanceUntil(page, drawsOnly(page, 0))
      expect((await lastFrame(page))[0]?.flow).toBe(flow)

      await togglePause(page)
      await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
    })
  })
}

test('keeps the CSS skies on a phone, with no canvas drawn', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.clock.install()
  await watchWebgl(page, GPU)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
  await scrollIntoView(page, '#pricing')
  await page.clock.runFor(2000)
  expect(await contexts(page)).toBe(0)
  expect(await backdropIs(page, 'css')()).toBe(true)
  await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
  await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
})

// Forced colours take the sky behind the page away, and its canvas with it.
test('keeps the hero’s CSS aurora where forced colours hide the sky', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.clock.install()
  await watchWebgl(page, GPU)
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'active' })
  await page.goto('/')
  await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
  await page.clock.runFor(2000)
  expect(await contexts(page)).toBe(0)
  expect(await backdropIs(page, 'css')()).toBe(true)
  await expect(sky(page)).toBeHidden()
  await expect(page.locator('.hero-sky')).toHaveCSS('visibility', 'visible')
})
