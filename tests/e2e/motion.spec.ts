import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { media, type SlotName } from '../../src/media.ts'
import { openFixture } from '../support/browser-fixture.ts'
import { animationsDone, frames, placeEdge, scrollToY, steady } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

// The motion helpers, run as modules in Chromium and WebKit under the site's own CSP.

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y)
const scrollToElement = (page: Page, selector: string, offset = 0) =>
  page.evaluate(
    ([sel, extra]) => {
      const top = (document.querySelector(sel as string) as HTMLElement).getBoundingClientRect().top
      window.scrollTo(0, window.scrollY + top + (extra as number))
    },
    [selector, offset],
  )
const opacity = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity))
const variable = (page: Page, selector: string, name: string) =>
  page
    .locator(selector)
    .evaluate((element, prop) => getComputedStyle(element).getPropertyValue(prop).trim(), name)

test.describe('revealOnScroll', () => {
  const fixture = {
    css: '.spacer { height: 2400px } .box { height: 120px; margin-bottom: 20px; background: var(--color-accent-fill) }',
    body: `<div class="spacer"></div>
      <div class="box" id="a" data-reveal></div>
      <div class="box" id="b" data-reveal="scale"></div>
      <div class="box" id="c" data-reveal="fade" data-reveal-index="4"></div>
      <div class="spacer"></div>
      <div class="box" id="far" data-reveal></div>`,
    script: `import { revealOnScroll } from '/__src/lib/motion.ts'; revealOnScroll()`,
  }

  test('hides elements below the fold, then reveals them in order as they arrive', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture)
    expect(await opacity(page, '#a')).toBe(0)

    await scrollToElement(page, '#a', -300)

    await expect.poll(() => opacity(page, '#a')).toBe(1)
    await expect.poll(() => opacity(page, '#c')).toBe(1)
    await expect(page.locator('#a')).toHaveAttribute('data-revealed', '')
    expect(await variable(page, '#a', '--site-reveal-delay')).toBe('0ms')
    expect(await variable(page, '#b', '--site-reveal-delay')).toBe('50ms')
    expect(await variable(page, '#c', '--site-reveal-delay')).toBe('200ms')
    expect(await opacity(page, '#far')).toBe(0)
  })

  test('hides at once and eases only the reveal, so late styles never fade an element out', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture)
    const durations = (id: string) =>
      page
        .locator(`#${id}`)
        .evaluate((element) => getComputedStyle(element).transitionDuration.split(', '))

    expect(await durations('far')).toEqual(['0s', '0s'])
    await scrollToElement(page, '#a', -300)
    await expect(page.locator('#a')).toHaveAttribute('data-revealed', '')

    expect(await durations('a')).toEqual(['0.4s', '0.4s'])
    expect(await durations('b')).toEqual(['0.7s', '0.7s'])
  })

  test('reveals once: scrolling back leaves the element shown', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture)
    await scrollToElement(page, '#a', -300)
    await expect.poll(() => opacity(page, '#a')).toBe(1)

    await scrollTo(page, 0)

    expect(await opacity(page, '#a')).toBe(1)
  })

  test('shows everything at once under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, fixture)

    for (const id of ['a', 'b', 'c', 'far']) {
      expect(await opacity(page, `#${id}`)).toBe(1)
      await expect(page.locator(`#${id}`)).toHaveAttribute('data-revealed', '')
      await expect(page.locator(`#${id}`)).toHaveCSS('transform', 'none')
      await expect(page.locator(`#${id}`)).toHaveCSS('transition-duration', '0s')
    }
  })
})

test.describe('scroll-linked CSS', () => {
  const fixture = {
    css: '.spacer { height: 1600px } .drift { height: 100px; width: 100px }',
    body: '<div class="spacer"></div><div class="drift" id="d" data-scroll="drift"></div><div class="spacer"></div>',
  }
  const shift = (page: Page) =>
    page.locator('#d').evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)

  test('drifts with the scroll in both directions where the browser supports it', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture)
    test.skip(
      !(await page.evaluate(() => CSS.supports('animation-timeline: view()'))),
      'no view timelines',
    )

    await scrollToElement(page, '#d', -600)
    await expect.poll(() => shift(page)).toBeLessThan(-10)
    const early = await shift(page)
    await scrollToElement(page, '#d', 200)
    await expect.poll(() => shift(page)).toBeGreaterThan(early + 50)
    await scrollToElement(page, '#d', -600)

    await expect.poll(() => shift(page)).toBeCloseTo(early, 0)
  })

  test('stays put under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, fixture)

    await scrollToElement(page, '#d', -300)

    expect(await shift(page)).toBe(0)
  })
})

test.describe('scrollEffects and scrubScroll', () => {
  const fixture = (when = '', lag = 0.45) => ({
    css: '.spacer { height: 1600px } .box { height: 100px; width: 100px; transform: translateX(calc(var(--x, 0) * 1px)) }',
    body: '<div class="spacer"></div><div class="box" id="box"></div><div class="spacer"></div>',
    script: `import { scrollEffects, scrubScroll } from '/__src/lib/scroll.ts'
      const box = document.getElementById('box')
      window.scene = { setups: 0, active: 0 }
      window.scene.stop = scrollEffects(() => {
        window.scene.setups += 1
        window.scene.active += 1
        const stop = scrubScroll((y) => box.style.setProperty('--x', String(Math.min(y, 1200) / 4)), { lag: ${lag} })
        return () => {
          stop()
          window.scene.active -= 1
          box.style.removeProperty('--x')
        }
      }${when ? `, { when: '${when}' }` : ''})`,
  })
  type Scene = { scene: { setups: number; active: number; stop: () => void } }
  const scene = (page: Page) =>
    page.evaluate(() => {
      const { setups, active } = (window as unknown as Scene).scene
      return { setups, active }
    })
  const moved = (page: Page) =>
    page
      .locator('#box')
      .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)

  test('eases toward the scroll, lands on it and runs both ways, without breaking the CSP', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture())
    await expect.poll(() => scene(page)).toEqual({ setups: 1, active: 1 })

    await scrollToY(page, 800)
    const caught = await steady(page, () => moved(page))
    expect(caught).toBe(200)
    await scrollToY(page, 0)

    expect(await steady(page, () => moved(page))).toBe(0)
  })

  test('trails a sudden jump instead of following it in one frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture('', 0.6))
    await expect.poll(() => scene(page)).toEqual({ setups: 1, active: 1 })

    await page.evaluate(() => window.scrollTo(0, 1200))
    await frames(page, 2)
    const early = await moved(page)

    expect(early).toBeGreaterThan(0)
    expect(early).toBeLessThan(300)
    expect(await steady(page, () => moved(page))).toBe(300)
  })

  test('sets nothing up under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, fixture())
    await page.waitForLoadState('load')

    expect(await scene(page)).toEqual({ setups: 0, active: 0 })
    await scrollToY(page, 800)
    await frames(page, 3)
    expect(await moved(page)).toBe(0)
  })

  test('undoes the effect and the styles it wrote when stopped', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture())
    await scrollToY(page, 800)
    expect(await steady(page, () => moved(page))).toBe(200)

    await page.evaluate(() => (window as unknown as Scene).scene.stop())
    expect(await moved(page)).toBe(0)
    await scrollToY(page, 1000)
    await frames(page, 3)

    expect(await scene(page)).toEqual({ setups: 1, active: 0 })
    expect(await moved(page)).toBe(0)
  })

  test('follows its extra media query as the window is resized', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 500, height: 700 })
    await openFixture(page, fixture('(min-width: 800px)'))
    await page.waitForLoadState('load')
    expect(await scene(page)).toEqual({ setups: 0, active: 0 })

    await page.setViewportSize({ width: 1000, height: 700 })
    await expect.poll(() => scene(page)).toEqual({ setups: 1, active: 1 })
    await page.setViewportSize({ width: 500, height: 700 })

    await expect.poll(() => scene(page)).toEqual({ setups: 1, active: 0 })
  })
})

test.describe('scroll-linked amplitude on the page at 1440 x 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  /** The translation of the element's computed transform, rounded to a tenth of a pixel. */
  const shift = (page: Page, selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform)
        return { x: Math.round(matrix.m41 * 10) / 10, y: Math.round(matrix.m42 * 10) / 10 }
      })
  const settledShift = (page: Page, selector: string) => steady(page, () => shift(page, selector))
  const timelines = (page: Page) => page.evaluate(() => CSS.supports('animation-timeline: view()'))

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const moves = reducedMotion === 'no-preference'

    test(`${moves ? 'drifts' : 'holds'} the hero copy and window over the first 400 px (${reducedMotion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')
      await animationsDone(page, '#hero')

      const rest = {
        copy: await settledShift(page, '.hero-copy'),
        rig: await settledShift(page, '.hero-rig'),
      }
      await scrollToY(page, 200)
      const middle = {
        copy: await settledShift(page, '.hero-copy'),
        rig: await settledShift(page, '.hero-rig'),
      }
      await scrollToY(page, 400)
      const end = {
        copy: await settledShift(page, '.hero-copy'),
        rig: await settledShift(page, '.hero-rig'),
      }

      if (moves) {
        expect(rest.copy.y - middle.copy.y).toBeGreaterThan(0)
        expect(rest.copy.y - end.copy.y).toBeGreaterThanOrEqual(40)
        expect(middle.rig.y - rest.rig.y).toBeGreaterThan(0)
        expect(end.rig.y - rest.rig.y).toBeGreaterThanOrEqual(40)
      } else {
        expect([middle, end]).toEqual([rest, rest])
      }
    })

    test(`${moves ? 'drifts' : 'holds'} the feature stage by 24 px or more across its well (${reducedMotion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')
      test.skip(moves && !(await timelines(page)), 'no view timelines')

      await placeEdge(page, '.feature-well', 'top', 0.9)
      const entering = await settledShift(page, '.feature-stage')
      await placeEdge(page, '.feature-well', 'bottom', 0.1)
      const leaving = await settledShift(page, '.feature-stage')

      if (moves) expect(entering.y - leaving.y).toBeGreaterThanOrEqual(24)
      else
        expect([entering, leaving]).toEqual([
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ])
    })

    test(`${moves ? 'raises' : 'holds'} a card's media by 24 px or more as it arrives (${reducedMotion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')
      test.skip(moves && !(await timelines(page)), 'no view timelines')

      await placeEdge(page, '.card-crop', 'top', 0.98)
      const arriving = await settledShift(page, '.card-crop')
      await placeEdge(page, '.card-crop', 'top', 0.3)
      const arrived = await settledShift(page, '.card-crop')

      if (moves) {
        expect(arriving.y - arrived.y).toBeGreaterThanOrEqual(24)
        expect(arrived.y).toBe(0)
      } else
        expect([arriving, arrived]).toEqual([
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ])
    })

    test(`${moves ? 'drifts' : 'holds'} the local-first rows by 5vw or more (${reducedMotion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto('/')
      test.skip(moves && !(await timelines(page)), 'no view timelines')

      await placeEdge(page, '.local__row', 'top', 0.9)
      const entering = await settledShift(page, '.local__row')
      await placeEdge(page, '.local__row', 'bottom', 0.1)
      const leaving = await settledShift(page, '.local__row')

      if (moves) expect(leaving.x - entering.x).toBeGreaterThanOrEqual(0.05 * 1440)
      else
        expect([entering, leaving]).toEqual([
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ])
    })
  }
})

test.describe('the page under reduced motion', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`moves nothing with the scroll at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await page.waitForLoadState('load')
      // The layers in the sky drift on the clock, not the scroll; the pill and the features marker
      // switch between states as sections change.
      const placed = () =>
        page.evaluate(() => {
          const skip = '.hero-sky *, [data-download-pill], [data-features-marker]'
          const out: Record<string, string> = {}
          document.querySelectorAll('body *').forEach((element, index) => {
            if (element.closest(skip)) return
            const style = getComputedStyle(element)
            const value = [style.transform, style.translate, style.scale, style.rotate].join(' | ')
            if (!/^(none \| )+none$/.test(value) && value !== ' |  |  | ') {
              out[`${index} ${element.tagName} ${element.className}`] = value
            }
          })
          const scrolled = document
            .getAnimations()
            .filter(
              (animation) =>
                animation.timeline && !(animation.timeline instanceof DocumentTimeline),
            )
            .map((animation) => (animation as CSSAnimation).animationName)
          return { out, scrolled }
        })

      const rest = await placed()
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 300; y < height; y += 600) {
        await scrollToY(page, y)
        expect(await placed(), `at ${y}`).toEqual(rest)
      }
      expect(rest.scrolled).toEqual([])
    })
  }
})

test.describe('clips', () => {
  const clip = (
    id: string,
    slot: SlotName,
  ) => `<video id="${id}" data-clip="${slot}" width="${media[slot].width}" height="${media[slot].height}"
    poster="/media/${slot}/${slot}-poster.webp" aria-label="A placeholder clip of the Devot window." preload="none" muted loop playsinline>
    <source data-src="/media/${slot}/${slot}.mp4" type="video/mp4">
    <source data-src="/media/${slot}/${slot}.webm" type="video/webm"></video>`
  const fixture = {
    css: 'video { display: block; width: 400px; height: auto } .spacer { height: 3000px }',
    body: `${clip('near', 'hero')}<div class="spacer"></div>${clip('far', 'card-1')}<div class="spacer"></div>`,
    script: `import { initClips } from '/__src/scripts/clips.ts'; initClips()`,
  }
  const paused = (page: Page, id: string) =>
    page.locator(`#${id}`).evaluate((video) => (video as HTMLVideoElement).paused)
  const played = (page: Page, id: string) =>
    page.locator(`#${id}`).evaluate((video) => (video as HTMLVideoElement).currentTime > 0)
  const sourced = (page: Page, id: string) =>
    page
      .locator(`#${id} source`)
      .evaluateAll(
        (sources) => sources.filter((s) => (s as HTMLSourceElement).getAttribute('src')).length,
      )
  const mediaRequests = (page: Page) => {
    const urls: string[] = []
    page.on('request', (request) => {
      if (/\.(mp4|webm)$/.test(request.url())) urls.push(new URL(request.url()).pathname)
    })
    return urls
  }

  test('plays a clip in view, defers the far one, and pauses a clip that scrolls away', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const requests = mediaRequests(page)
    await openFixture(page, fixture)
    const decodes = await page.evaluate(() =>
      ['video/mp4', 'video/webm'].some((type) => document.createElement('video').canPlayType(type)),
    )
    test.skip(!decodes, 'this browser plays neither MP4 nor WebM')

    await expect.poll(() => played(page, 'near')).toBe(true)
    expect(await paused(page, 'near')).toBe(false)
    expect(await sourced(page, 'far')).toBe(0)
    expect(requests.filter((url) => url.includes('card-1'))).toEqual([])

    await scrollToElement(page, '#far', -(page.viewportSize()?.height ?? 720) - 300)
    await expect.poll(() => sourced(page, 'far')).toBeGreaterThan(0)
    expect(await paused(page, 'far')).toBe(true)
    await expect.poll(() => paused(page, 'near')).toBe(true)

    await scrollToElement(page, '#far', -100)
    await expect.poll(() => played(page, 'far')).toBe(true)
    expect(await paused(page, 'far')).toBe(false)
  })

  test('plays a clip in view under reduced motion too, and still defers the far one', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const requests = mediaRequests(page)
    await openFixture(page, fixture)

    await expect.poll(() => played(page, 'near')).toBe(true)
    expect(await paused(page, 'near')).toBe(false)
    expect(await sourced(page, 'far')).toBe(0)
    expect(requests.filter((url) => url.includes('card-1'))).toEqual([])
  })

  test('reserves its space from width and height before anything loads', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, fixture)

    const box = await page.locator('#near').boundingBox()
    expect(box?.width).toBe(400)
    expect(box?.height).toBeCloseTo((400 * media.hero.height) / media.hero.width, 0)
  })

  test('passes an accessibility scan', async ({ page }) => {
    await openFixture(page, fixture)

    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()

    expect(scan.violations.map(({ id }) => id)).toEqual([])
  })
})
