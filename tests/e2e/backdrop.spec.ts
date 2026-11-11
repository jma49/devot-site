import type { Page } from '@playwright/test'
import { BUILD_BUDGET, DRAW_CHECK, REDUCED_FLOW } from '../../src/scripts/hero-backdrop.ts'
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
  /** The flow time the shader drew. */
  flow: number
}

/**
 * Counts WebGL contexts and draws and keeps each draw's flow time (the last `uniform1f` before
 * it), and names the renderer `renderer`: headless Chromium draws on SwiftShader, which the page
 * rightly refuses, so the WebGL tests name a GPU. A GPU draws in no time, so the time the software
 * GL takes over a draw, until the page has read it back, is kept from the page's clock.
 */
async function watchWebgl(page: Page, renderer: string) {
  await page.addInitScript((name) => {
    const record = window as unknown as { glContexts: number; glDraws: Draw[] }
    record.glContexts = 0
    record.glDraws = []
    const proto = WebGLRenderingContext.prototype
    const { getParameter, uniform1f, drawArrays, readPixels } = proto
    const getContext = HTMLCanvasElement.prototype.getContext
    let last = Number.NaN
    const clock = performance.now.bind(performance)
    let hidden = 0
    performance.now = () => clock() - hidden
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
      const began = clock()
      drawArrays.apply(this, args)
      hidden += clock() - began
    }
    proto.readPixels = function (this: WebGLRenderingContext, ...args) {
      const began = clock()
      readPixels.apply(this, args)
      hidden += clock() - began
    } as typeof readPixels
  }, renderer)
}

const draws = (page: Page) =>
  page.evaluate(() => (window as unknown as { glDraws: Draw[] }).glDraws.slice())
const contexts = (page: Page) =>
  page.evaluate(() => (window as unknown as { glContexts: number }).glContexts)
/**
 * Has the page find KHR_parallel_shader_compile, with every program reported as built: the test
 * browsers' software GL does not offer it.
 */
async function buildBeside(page: Page) {
  await page.addInitScript(() => {
    const COMPLETION_STATUS_KHR = 0x91b1
    const proto = WebGLRenderingContext.prototype
    const getExtension = proto.getExtension as (
      this: WebGLRenderingContext,
      name: string,
    ) => unknown
    const getProgramParameter = proto.getProgramParameter
    proto.getExtension = function (this: WebGLRenderingContext, name: string) {
      return name === 'KHR_parallel_shader_compile'
        ? { COMPLETION_STATUS_KHR }
        : getExtension.call(this, name)
    } as typeof proto.getExtension
    proto.getProgramParameter = function (
      this: WebGLRenderingContext,
      program: WebGLProgram,
      name: number,
    ) {
      return name === COMPLETION_STATUS_KHR ? true : getProgramParameter.call(this, program, name)
    } as typeof getProgramParameter
  })
}

/** Has the page build its shaders on the main thread, as a browser without the extension does. */
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

/** Keeps how opaque each canvas was when the page gave its context back. */
async function watchRelease(page: Page) {
  await page.addInitScript(() => {
    const record = window as unknown as { released: string[] }
    record.released = []
    const proto = WebGLRenderingContext.prototype
    const getExtension = proto.getExtension as (
      this: WebGLRenderingContext,
      name: string,
    ) => unknown
    proto.getExtension = function (this: WebGLRenderingContext, name: string) {
      const extension = getExtension.call(this, name) as WEBGL_lose_context | null
      if (name !== 'WEBGL_lose_context' || !extension) return extension
      const canvas = this.canvas as HTMLCanvasElement
      return {
        loseContext() {
          record.released.push(getComputedStyle(canvas).opacity)
          extension.loseContext()
        },
        restoreContext: () => extension.restoreContext(),
      }
    } as typeof proto.getExtension
  })
}
const released = (page: Page) =>
  page.evaluate(() => (window as unknown as { released: string[] }).released.slice())

/** Has the browser take the canvas's context away, as it does when the GPU is reset. */
const loseContext = (page: Page, canvas: string) =>
  page.locator(canvas).evaluate((element: HTMLCanvasElement) => {
    const lose = element.getContext('webgl')?.getExtension('WEBGL_lose_context')
    ;(window as unknown as { lose: typeof lose }).lose = lose
    lose?.loseContext()
  })
/** And give it back. */
const restoreContext = (page: Page) =>
  page.evaluate(() => (window as unknown as { lose: WEBGL_lose_context }).lose.restoreContext())

/**
 * Has frames reach the page `quick` and `late` milliseconds apart by turns, whatever the clock
 * says; `beforeFrame` runs ahead of each with the clock's own time.
 */
async function paceFrames(page: Page, quick: number, late: number) {
  await page.addInitScript(
    ([first, second]) => {
      const hooks = window as unknown as { beforeFrame?: (now: number) => void }
      const request = window.requestAnimationFrame.bind(window)
      let at = 0
      let count = 0
      let frame = Number.NaN
      window.requestAnimationFrame = (callback) =>
        request((now) => {
          // Every callback of one frame gets the same time.
          if (now !== frame) {
            frame = now
            hooks.beforeFrame?.(now)
            at += (count++ % 2 ? second : first) ?? 0
          }
          callback(at)
        })
    },
    [quick, late],
  )
}

/**
 * Has `call` on a WebGL context take `ms` of the page's time: the fake clock stands still through
 * a task, so the page's `performance.now()` is moved on instead. After `page.clock.install()`.
 */
async function takeTime(page: Page, call: 'linkProgram' | 'readPixels', ms: number) {
  await page.addInitScript(
    ([name, cost]) => {
      const now = performance.now.bind(performance)
      let spent = 0
      performance.now = () => now() + spent
      const proto = WebGLRenderingContext.prototype as unknown as Record<
        string,
        (this: WebGLRenderingContext, ...args: unknown[]) => unknown
      >
      const original = proto[name]
      proto[name] = function (this: WebGLRenderingContext, ...args: unknown[]) {
        spent += cost
        return original?.apply(this, args)
      }
    },
    [call, ms] as const,
  )
}

/** Scrolls the page in steps, every tenth frame, as a wheel does, while `scrolling` is set. */
async function scrollInSteps(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as { scrolling: boolean; beforeFrame: (now: number) => void }
    state.scrolling = true
    state.beforeFrame = (now) => {
      if (state.scrolling && Math.round(now / 16) % 10 === 0) {
        window.scrollBy(0, window.scrollY < 200 ? 20 : -200)
      }
    }
  })
}

const hero = (page: Page) => page.locator('[data-hero]')
const sky = (page: Page) => page.locator('[data-page-sky]')
const skyIs = (page: Page, kind: 'webgl' | 'css') => () =>
  sky(page).evaluate((element, expected) => element.dataset['backdrop'] === expected, kind)

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
      await pauseSoon(page)
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

  // A browser saving energy runs every frame 30 times a second, which is the shader's own pace.
  test('keeps the shader in a browser whose frames all come 33 ms apart', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await paceFrames(page, 33, 33)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, backdropIs(page, 'webgl'))
    // Twice the frames the check reads.
    await page.clock.runFor(2500)
    await expect(hero(page)).toHaveAttribute('data-backdrop', 'webgl')
    await expect(hero(page)).not.toHaveAttribute('data-backdrop-reason')
  })

  // Clips starting hold up frames on any machine: that is the page, and the GPU draws in time.
  test('keeps the shader through a second of frames held up by the page', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await paceFrames(page, 16, 48)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, backdropIs(page, 'webgl'))
    await page.clock.runFor(2500)
    await expect(hero(page)).toHaveAttribute('data-backdrop', 'webgl')
  })

  test('hands back to the CSS aurora when no draw takes the GPU 10 ms or less', async ({
    page,
  }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await takeTime(page, 'readPixels', DRAW_CHECK.ms + 10)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-reason', 'slow')
    // The draw that built the shader, and the ones that were timed.
    expect(await draws(page)).toHaveLength(DRAW_CHECK.draws + 1)
    expect(
      (await swayStates(page)).filter(({ state }) => state === 'running').length,
    ).toBeGreaterThan(0)
  })

  test('hands back to the CSS aurora when its frames come 48 ms apart', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await watchRelease(page)
    await paceFrames(page, 48, 48)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, async () => (await draws(page)).length > 0)
    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-reason', 'slow')
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
    // The canvas is out of sight before its context goes: a lost canvas has no picture left.
    await advanceUntil(page, async () => (await released(page)).length > 0)
    expect(await released(page)).toEqual(['0'])
    const held = (await draws(page)).length
    await page.clock.runFor(1000)
    expect(await draws(page)).toHaveLength(held)
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
    await paceFrames(page, 40, 40)
    await scrollInSteps(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, backdropIs(page, 'webgl'))
    // Twice the frames the check reads.
    await page.clock.runFor(2500)
    await expect(hero(page)).toHaveAttribute('data-backdrop', 'webgl')

    // At rest the same frames are too far apart for the shader's own pace.
    await page.evaluate(() => {
      ;(window as unknown as { scrolling: boolean }).scrolling = false
    })
    await advanceUntil(page, backdropIs(page, 'css'))
  })

  // A software GL draws on at a few frames a second through a whole scroll.
  test('hands back even while the page scrolls when frames come 64 ms apart', async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await paceFrames(page, 64, 64)
    await scrollInSteps(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    await advanceUntil(page, async () => (await draws(page)).length > 0)
    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
  })

  test('hands back to the CSS aurora while the browser has taken its context, and takes it up again', async ({
    page,
    problems,
  }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await advanceUntil(page, backdropIs(page, 'webgl'))

    await loseContext(page, '.hero-canvas')
    await advanceUntil(page, backdropIs(page, 'css'))
    await expect(hero(page)).toHaveAttribute('data-backdrop-reason', 'lost')
    // A canvas without its context is blank: it goes at once and does not fade out.
    await expect(page.locator('.hero-canvas')).toHaveCSS('transition-duration', '0s')
    await expect(page.locator('.hero-canvas')).toHaveCSS('opacity', '0')
    const held = (await draws(page)).length
    await page.clock.runFor(1000)
    expect(await draws(page)).toHaveLength(held)
    expect(
      (await swayStates(page)).filter(({ state }) => state === 'running').length,
    ).toBeGreaterThan(0)

    // The browser gives the context back, and the shader is built again.
    await restoreContext(page)
    await advanceUntil(page, backdropIs(page, 'webgl'))
    await expect(hero(page)).not.toHaveAttribute('data-backdrop-reason')
    await advanceUntil(page, async () => (await draws(page)).length > held + 10)
    // WebKit logs every lost context, this deliberate one too.
    const logged = problems.filter((text) => text !== 'WebGL: context lost.')
    problems.splice(0, problems.length, ...logged)
  })
})

// The hero's shader goes on behind the rest of the page, in its soft form, on a canvas fixed to
// the viewport. The hero covers that sky at the top of the page.
test.describe('WebGL sky behind the page', () => {
  test.use({ viewport: DESKTOP })

  test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await watchWebgl(page, GPU)
    await buildBeside(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await advanceUntil(page, backdropIs(page, 'webgl'))
  })

  test('is not built while the hero covers the page', async ({ page }) => {
    await page.clock.runFor(1500)
    expect(await contexts(page)).toBe(1)
    await expect(sky(page)).toHaveAttribute('data-backdrop', 'css')
    await expect(page.locator('.page-sky__canvas')).toHaveCSS('opacity', '0')
  })

  test('flows behind the sections once one is on screen, and rests under the hero again', async ({
    page,
  }) => {
    await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
    await advanceUntil(page, skyIs(page, 'webgl'))
    expect(await contexts(page)).toBe(2)
    await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'idle')
    await expect(page.locator('.page-sky__canvas')).toHaveCSS('opacity', '1')
    await expect(page.locator('.page-sky__canvas')).not.toHaveCSS('transition-duration', '0s')
    await expect(page.locator('.page-sky [data-aurora="dark"] .aurora-band').first()).toHaveCSS(
      'visibility',
      'hidden',
    )

    // Only the sky draws here: the hero is off screen.
    await pauseSoon(page)
    const start = (await draws(page)).length
    await page.clock.runFor(3000)
    const seen = (await draws(page)).slice(start)
    expect(seen.length).toBeGreaterThanOrEqual(80)
    expect(flowPerSecond(seen)).toBeCloseTo(1, 1)

    await page.clock.resume()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'idle')
    await expect(hero(page)).toHaveAttribute('data-backdrop-state', 'running')
    await expect(sky(page)).toHaveAttribute('data-backdrop', 'webgl')
  })

  test('goes at once, without fading, when the GPU drops its context', async ({
    page,
    problems,
  }) => {
    await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
    await advanceUntil(page, skyIs(page, 'webgl'))
    await loseContext(page, '.page-sky__canvas')
    await advanceUntil(page, skyIs(page, 'css'))
    await expect(sky(page)).toHaveAttribute('data-backdrop-reason', 'lost')
    await expect(page.locator('.page-sky__canvas')).toHaveCSS('transition-duration', '0s')
    await expect(page.locator('.page-sky__canvas')).toHaveCSS('opacity', '0')
    // WebKit logs every lost context, this deliberate one too.
    const logged = problems.filter((text) => text !== 'WebGL: context lost.')
    problems.splice(0, problems.length, ...logged)
  })

  test('stops with the pause', async ({ page }) => {
    await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
    await advanceUntil(page, skyIs(page, 'webgl'))
    await togglePause(page)
    await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'idle')
    const held = (await draws(page)).length
    await page.clock.runFor(2000)
    expect(await draws(page)).toHaveLength(held)

    await togglePause(page)
    await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
  })
})

test('keeps the CSS sky behind the page on a phone', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.clock.install()
  await watchWebgl(page, GPU)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
  await page.clock.runFor(2000)
  expect(await contexts(page)).toBe(0)
  await expect(sky(page)).toHaveAttribute('data-backdrop', 'css')
  await expect(sky(page)).not.toHaveAttribute('data-backdrop-state', /.*/)
})

test('keeps the CSS sky behind the page, and still, on a software renderer', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.clock.install()
  await watchWebgl(page, SOFTWARE)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await advanceUntil(page, async () => (await contexts(page)) > 0)
  await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
  await advanceUntil(page, async () => (await contexts(page)) > 1)
  await page.clock.runFor(1000)
  await expect(sky(page)).toHaveAttribute('data-backdrop', 'css')
  await expect(page.locator('html')).toHaveAttribute('data-aurora-still', '')
  expect(await draws(page)).toEqual([])
})

// The user's browser may have no KHR_parallel_shader_compile; a GPU builds the shader in a moment
// all the same. The fake clock stands still through the build, as a quick one nearly does.
test('builds the sky’s shader on the main thread where that is quick', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await page.clock.install()
  await watchWebgl(page, GPU)
  await buildOnMainThread(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await advanceUntil(page, backdropIs(page, 'webgl'))

  await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
  await advanceUntil(page, skyIs(page, 'webgl'))
  expect(await contexts(page)).toBe(2)
  await expect(sky(page)).not.toHaveAttribute('data-backdrop-reason')
})

// A second build as slow as the first would hold the page in the middle of a scroll.
test('builds no second shader for the sky where the hero’s held the main thread too long', async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP)
  await page.clock.install()
  await watchWebgl(page, GPU)
  await buildOnMainThread(page)
  await takeTime(page, 'linkProgram', BUILD_BUDGET + 100)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await advanceUntil(page, backdropIs(page, 'webgl'))

  await page.locator('#pricing').evaluate((section) => section.scrollIntoView())
  await advanceUntil(
    page,
    async () => (await sky(page).getAttribute('data-backdrop-reason')) === 'costly',
  )
  await expect(sky(page)).toHaveAttribute('data-backdrop-state', 'running')
  await expect(sky(page)).toHaveAttribute('data-backdrop', 'css')
  expect(await contexts(page)).toBe(1)
  // The CSS sky goes on drifting: this is not a missing GPU.
  await expect(page.locator('html')).not.toHaveAttribute('data-aurora-still')
})
