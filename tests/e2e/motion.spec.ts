import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { openFixture } from '../support/browser-fixture.ts'
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

test.describe('scrollEffects', () => {
  const fixture = (when = '') => ({
    css: '.spacer { height: 1600px } .box { height: 100px; width: 100px }',
    body: '<div class="spacer"></div><div class="box" id="box"></div><div class="spacer"></div>',
    script: `import { gsap, ScrollTrigger, scrollEffects } from '/__src/lib/scroll.ts'
      window.sceneEffects = {
        stop: scrollEffects(() => {
          gsap.to('#box', { x: 300, ease: 'none', scrollTrigger: { trigger: '#box', start: 'top bottom', end: 'bottom top', scrub: true } })
        }, ${when ? `{ when: '${when}' }` : ''}),
        triggers: () => ScrollTrigger.getAll().length,
      }`,
  })
  type Fx = { sceneEffects: { stop: () => void; triggers: () => number } }
  const triggers = (page: Page) =>
    page.evaluate(() => (window as unknown as Fx).sceneEffects.triggers())
  const moved = (page: Page) =>
    page
      .locator('#box')
      .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41)

  test('moves an element with the scroll, both ways, without breaking the CSP', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture())
    await expect.poll(() => triggers(page)).toBe(1)

    await scrollToElement(page, '#box', -700)
    await expect.poll(() => moved(page)).toBeLessThan(10)
    await scrollToElement(page, '#box', -300)
    await expect.poll(() => moved(page)).toBeGreaterThan(100)
    await scrollToElement(page, '#box', -700)

    await expect.poll(() => moved(page)).toBeLessThan(10)
  })

  test('creates nothing under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, fixture())

    await page.waitForLoadState('load')
    expect(await triggers(page)).toBe(0)
    await scrollToElement(page, '#box', -300)
    await expect(page.locator('#box')).toHaveCSS('transform', 'none')
  })

  test('removes the triggers and the styles it wrote when stopped', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, fixture())
    await expect.poll(() => triggers(page)).toBe(1)
    await scrollToElement(page, '#box', -300)
    await expect.poll(() => moved(page)).toBeGreaterThan(100)

    await page.evaluate(() => (window as unknown as Fx).sceneEffects.stop())

    expect(await triggers(page)).toBe(0)
    expect(
      await page.locator('#box').evaluate((element) => (element as HTMLElement).style.transform),
    ).toBe('')
  })

  test('follows its extra media query as the window is resized', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 500, height: 700 })
    await openFixture(page, fixture('(min-width: 800px)'))
    await page.waitForLoadState('load')
    expect(await triggers(page)).toBe(0)

    await page.setViewportSize({ width: 1000, height: 700 })
    await expect.poll(() => triggers(page)).toBe(1)
    await page.setViewportSize({ width: 500, height: 700 })

    await expect.poll(() => triggers(page)).toBe(0)
  })
})

test.describe('clips', () => {
  const clip = (
    id: string,
    slot: string,
  ) => `<video id="${id}" data-clip="${slot}" width="1500" height="1080"
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

  test('shows only the poster under reduced motion and fetches no clip', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const requests = mediaRequests(page)
    await openFixture(page, fixture)
    await page.waitForLoadState('load')

    expect(await paused(page, 'near')).toBe(true)
    expect(await sourced(page, 'near')).toBe(0)
    await scrollToElement(page, '#far', -100)
    expect(await paused(page, 'far')).toBe(true)
    expect(requests).toEqual([])
  })

  test('reserves its space from width and height before anything loads', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openFixture(page, fixture)

    const box = await page.locator('#near').boundingBox()
    expect(box?.width).toBe(400)
    expect(box?.height).toBeCloseTo((400 * 1080) / 1500, 0)
  })

  test('passes an accessibility scan', async ({ page }) => {
    await openFixture(page, fixture)

    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()

    expect(scan.violations.map(({ id }) => id)).toEqual([])
  })
})
