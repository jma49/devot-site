import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { en } from '../../src/i18n/en.ts'
import { REPO_URL } from '../../src/site.ts'
import { animationsDone, frames, scrollToY } from '../support/settle.ts'
import { expect, test } from './fixtures.ts'

const desktop = { width: 1440, height: 900 }
const tablet = { width: 768, height: 1024 }
const phone = { width: 390, height: 844 }
/** The motion curves the entrance may use: Devot's standard and move curves. */
const CURVES = [
  'cubic-bezier(0.42, 0, 0.58, 1)',
  'ease-in-out',
  'cubic-bezier(0.38, 0.7, 0.125, 1)',
]

/** Gives the sections after the hero some height, so the page scrolls before they have content. */
async function openPage(page: Page) {
  await page.goto('/')
  await page.evaluate(() => {
    for (const section of document.querySelectorAll<HTMLElement>('main > section:not(#hero)')) {
      section.style.setProperty('min-height', '120vh')
    }
  })
}

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y)
const scrollToId = (page: Page, id: string) =>
  page.evaluate((target) => document.getElementById(target)?.scrollIntoView(), id)
const heroVar = (page: Page, name: string) =>
  page
    .locator('[data-hero]')
    .evaluate((hero, prop) => Number(getComputedStyle(hero).getPropertyValue(prop)), name)
const rigTransform = (page: Page) =>
  page.locator('.hero-rig').evaluate((rig) => getComputedStyle(rig).transform)
const opacity = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity))
const heroCta = (page: Page) => page.locator('#hero').getByRole('link', { name: en.download.label })
const pill = (page: Page) => page.locator('[data-download-pill]')

async function violations(page: Page): Promise<string[]> {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  return scan.violations.map(({ id, nodes }) => `${id} (${nodes.length})`)
}

test.describe('hero at 1440 x 900', () => {
  test.use({ viewport: desktop })

  test('shows the headline, the download and most of the window above the fold', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openPage(page)
    await animationsDone(page, '#hero')

    const title = await page.getByRole('heading', { level: 1 }).boundingBox()
    const cta = await heroCta(page).boundingBox()
    const frame = await page.locator('.hero-frame').boundingBox()
    expect(title && title.y + title.height).toBeLessThan(desktop.height)
    expect(cta && cta.y + cta.height).toBeLessThan(desktop.height)
    await expect(page.locator('#hero').getByText(en.download.requirements)).toBeInViewport()
    expect(frame).not.toBeNull()
    const shown = (desktop.height - (frame?.y ?? 0)) / (frame?.height ?? 1)
    expect(shown).toBeGreaterThanOrEqual(0.55)
    expect(shown).toBeLessThan(1)

    const clip = page.locator('.hero-frame video[data-clip="hero"]')
    await expect(clip).toHaveAttribute('poster', /hero-poster\.webp$/)
  })

  test('paints the backdrop at full strength with the first frame, before any script', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.addInitScript(() => {
      const first = () => {
        const backdrop = document.querySelector('.hero-backdrop')
        if (!backdrop) return requestAnimationFrame(first)
        const shown = (element: Element | null) =>
          element !== null &&
          Number(getComputedStyle(element).opacity) === 1 &&
          getComputedStyle(element).visibility === 'visible'
        const fallback = [...document.querySelectorAll('.hero-fallback')].find(
          (element) => getComputedStyle(element).display !== 'none',
        )
        ;(window as unknown as { firstFrame: unknown }).firstFrame = {
          backdrop: shown(backdrop),
          sky: shown(document.querySelector('.hero-sky')),
          gradient: fallback
            ? getComputedStyle(fallback).backgroundImage.includes('gradient')
            : false,
        }
      }
      requestAnimationFrame(first)
    })
    await page.goto('/')

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { firstFrame: unknown }).firstFrame))
      .toEqual({ backdrop: true, sky: true, gradient: true })
    const fades = await page.evaluate(() =>
      ['.hero-backdrop', '.hero-sky', '.hero-fallback', '.hero-window', '.hero-frame'].flatMap(
        (selector) =>
          [...document.querySelectorAll(selector)].flatMap((element) =>
            element
              .getAnimations()
              .filter((animation) =>
                (animation.effect as KeyframeEffect | null)
                  ?.getKeyframes()
                  .some((frame) => 'opacity' in frame),
              )
              .map(() => selector),
          ),
      ),
    )
    expect(fades).toEqual([])
  })

  test('loads the WebGL backdrop once the page has loaded, over the CSS gradient', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const hero = page.locator('[data-hero]')

    await expect(hero).toHaveAttribute('data-backdrop-state', /^(running|idle)$/)
    // After the load event and idle time: paint timing itself can trail the drawn frame by
    // several frames, so it makes no reliable bound.
    const timing = await page.evaluate(() => ({
      load: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
        .loadEventEnd,
      chunk:
        performance
          .getEntriesByType('resource')
          .find((entry) => /\/hero-backdrop\.[\w-]+\.js$/.test(entry.name))?.startTime ?? null,
    }))
    expect(timing.chunk).not.toBeNull()
    expect(timing.chunk).toBeGreaterThanOrEqual(timing.load)
  })

  test('paints the window poster as the largest element', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Largest Contentful Paint is a Chromium API')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    // The latest candidate counts; on a busy machine text can paint before the poster arrives.
    const latest = () =>
      page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            new PerformanceObserver((list) => {
              const last = list.getEntries().at(-1) as PerformanceEntry & { element?: Element }
              resolve(last?.element?.tagName ?? 'none')
            }).observe({ type: 'largest-contentful-paint', buffered: true })
          }),
      )
    await expect.poll(latest).toBe('VIDEO')
  })

  test('enters within 100 ms on the motion curves and settles within 1.4 s', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')

    const timing = await page.evaluate(() => {
      const of = (selector: string) =>
        document
          .querySelector(selector)
          ?.getAnimations()
          .map((animation) => {
            const effect = animation.effect as KeyframeEffect | null
            const { delay, duration } = effect?.getTiming() ?? {}
            // A CSS animation's timing function sits on its keyframes, not on the effect.
            const easing = effect?.getKeyframes()[0]?.easing
            return { delay: Number(delay), duration: Number(duration), easing }
          }) ?? []
      return {
        backdrop: of('.hero-sky'),
        title: of('.hero-line'),
        window: of('.hero-window'),
        cta: of('.hero-cta-inner'),
      }
    })
    const all = Object.values(timing).flat()
    expect(all.length).toBeGreaterThanOrEqual(5)
    for (const { delay } of all) expect(delay).toBeLessThanOrEqual(100)
    const longest = (list: { duration: number }[]) => Math.max(...list.map((a) => a.duration))
    expect(longest(timing.backdrop)).toBeGreaterThanOrEqual(1000)
    expect(longest(timing.backdrop)).toBeLessThanOrEqual(1400)
    expect(longest(timing.title)).toBeGreaterThanOrEqual(800)
    expect(longest(timing.title)).toBeLessThanOrEqual(1000)
    expect(longest(timing.window)).toBeGreaterThanOrEqual(1000)
    expect(longest(timing.window)).toBeLessThanOrEqual(1200)
    expect(longest(timing.cta)).toBeGreaterThanOrEqual(1200)
    expect(longest(timing.cta)).toBeLessThanOrEqual(1400)
    // Devot's standard curve is CSS's ease-in-out, which WebKit reports by its keyword.
    const curves = new Set(all.map(({ easing }) => easing))
    expect(curves.size).toBe(2)
    for (const curve of curves) expect(CURVES).toContain(curve)
  })

  test('stands the window up and lets the copy drift away as the page scrolls, both ways', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openPage(page)
    const rest = await rigTransform(page)

    await scrollTo(page, 300)
    await expect.poll(() => heroVar(page, '--hero-settle')).toBeCloseTo(300 / (0.6 * 900), 2)
    await expect.poll(() => heroVar(page, '--hero-sheen')).toBe(0)
    await expect.poll(() => heroVar(page, '--hero-dome')).toBe(1)
    await expect.poll(() => opacity(page, '.hero-copy')).toBeLessThan(0.5)
    await expect.poll(() => heroVar(page, '--hero-lift')).toBeCloseTo(105, 0)
    await expect.poll(() => rigTransform(page)).not.toBe(rest)

    await scrollTo(page, 0)
    await expect.poll(() => heroVar(page, '--hero-settle')).toBe(0)
    await expect.poll(() => opacity(page, '.hero-copy')).toBe(1)
    await expect.poll(() => rigTransform(page)).toBe(rest)
  })

  test('animates the backdrop only while the hero is on screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openPage(page)
    const hero = page.locator('[data-hero]')

    await expect(hero).toHaveAttribute('data-backdrop', /^(webgl|css)$/)
    await expect(hero).toHaveAttribute('data-backdrop-state', 'running')
    await scrollToId(page, 'cards')
    await expect(hero).toHaveAttribute('data-backdrop-state', 'idle')
    await scrollTo(page, 0)
    await expect(hero).toHaveAttribute('data-backdrop-state', 'running')
  })

  test('links the floating navigation to every section and to the source', async ({ page }) => {
    await openPage(page)
    const nav = page.getByRole('navigation', { name: en.chrome.navLabel })

    for (const [label, id] of [
      [en.chrome.nav.write, 'write'],
      [en.chrome.nav.cards, 'cards'],
      [en.chrome.nav.localFirst, 'local-first'],
      [en.chrome.nav.download, 'download'],
    ] as const) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'href',
        `/#${id}`,
      )
    }
    await expect(nav.getByRole('link', { name: en.chrome.nav.source })).toHaveAttribute(
      'href',
      REPO_URL,
    )
    await expect(page.getByRole('button', { name: en.chrome.menu })).toBeHidden()
    await expect(page.getByRole('banner')).toHaveCSS('position', 'fixed')
  })

  test('marks the section being read', async ({ page }) => {
    await openPage(page)
    const nav = page.getByRole('navigation', { name: en.chrome.navLabel })

    await scrollToId(page, 'cards')
    await expect(nav.getByRole('link', { name: en.chrome.nav.cards })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await expect(nav.locator('[aria-current]')).toHaveCount(1)
    await scrollTo(page, 0)
    await expect(nav.locator('[aria-current]')).toHaveCount(0)
  })

  test('shows the download pill once the hero button scrolls out, until the closing one', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openPage(page)
    const button = pill(page).getByRole('link', { name: en.download.label })

    await expect(pill(page)).toBeHidden()
    await scrollTo(page, 700)
    await expect(button).toBeVisible()
    await expect.poll(() => opacity(page, '[data-download-pill]')).toBe(1)
    await expect(button).toHaveAccessibleDescription(en.chrome.downloadNote)
    await expect(pill(page)).toHaveCSS('scale', '1')

    await scrollToId(page, 'download')
    await expect(pill(page)).toBeHidden()
    await scrollTo(page, 0)
    await expect(pill(page)).toBeHidden()
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`passes an accessibility scan in the ${colorScheme} appearance`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await openPage(page)
      expect(await violations(page)).toEqual([])
      await scrollTo(page, 900)
      await expect(pill(page)).toBeVisible()
      expect(await violations(page)).toEqual([])
    })
  }
})

test.describe('hero at 390 x 844', () => {
  test.use({ viewport: phone })

  test('stacks the call to action under the window, with nothing wider than the screen', async ({
    page,
  }) => {
    await openPage(page)

    const frame = await page.locator('.hero-frame').boundingBox()
    const cta = await heroCta(page).boundingBox()
    expect(cta?.y).toBeGreaterThan(frame?.y ?? Infinity)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(phone.width)
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
  })

  test('keeps the CSS gradient, still pausing it while the hero is off screen', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openPage(page)
    const hero = page.locator('[data-hero]')

    await expect(hero).toHaveAttribute('data-backdrop-state', 'running')
    await expect(hero).toHaveAttribute('data-backdrop', 'css')
    await expect(page.locator('.hero-canvas')).toHaveCSS('opacity', '0')
    await scrollToId(page, 'cards')
    await expect(hero).toHaveAttribute('data-backdrop-state', 'idle')
  })

  test('opens a full-screen menu that keeps focus and scroll, and closes on Escape', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)
    const button = page.getByRole('button', { name: en.chrome.menu })
    const nav = page.getByRole('navigation', { name: en.chrome.navLabel })
    const first = nav.getByRole('link', { name: en.chrome.nav.write, exact: true })

    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(first).toBeHidden()
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(first).toBeFocused()
    await expect(page.locator('html')).toHaveCSS('overflow', 'hidden')
    expect(await page.locator('main').evaluate((main: HTMLElement) => main.inert)).toBe(true)
    expect(await violations(page)).toEqual([])

    const inside = () => page.evaluate(() => !!document.activeElement?.closest('[data-menu-scope]'))
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press('Tab')
      expect(await inside()).toBe(true)
    }
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press('Shift+Tab')
      expect(await inside()).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(button).toBeFocused()
    await expect(first).toBeHidden()
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
    expect(await page.locator('main').evaluate((main: HTMLElement) => main.inert)).toBe(false)
  })

  test('closes the menu when a section is chosen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)
    const button = page.getByRole('button', { name: en.chrome.menu })

    await button.click()
    await page
      .getByRole('navigation', { name: en.chrome.navLabel })
      .getByRole('link', { name: en.chrome.nav.cards })
      .click()
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(page).toHaveURL(/#cards$/)
    await expect(page.locator('#cards')).toBeInViewport()
  })

  test('closes the menu when the window grows to the desktop layout', async ({ page }) => {
    await openPage(page)
    const button = page.getByRole('button', { name: en.chrome.menu })
    await button.click()

    await page.setViewportSize(desktop)
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden')
    expect(await page.locator('main').evaluate((main: HTMLElement) => main.inert)).toBe(false)
  })
})

for (const viewport of [phone, tablet]) {
  test.describe(`download pill at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('stays at most 64 px tall, inside the screen, after the hero', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')

      await scrollToY(page, viewport.height * 1.5)
      await expect(pill(page)).toBeVisible()
      await animationsDone(page, '[data-download-pill]')
      const box = await pill(page).boundingBox()
      expect(box?.height).toBeLessThanOrEqual(64)
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height)
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
    })

    test('hides while the closing section is on screen and never covers its links or the footer', async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.goto('/')
      const { start, end } = await page.evaluate(() => {
        const closing = document.getElementById('download')?.getBoundingClientRect()
        return {
          start: window.scrollY + (closing?.top ?? 0) - innerHeight - 240,
          end: document.documentElement.scrollHeight - innerHeight,
        }
      })
      await scrollToY(page, start)
      await expect(pill(page)).toBeVisible()

      const step = Math.round(viewport.height / 3)
      for (let y = start + step; y < end + step; y += step) {
        await scrollToY(page, y)
        const closingOnScreen = await page.evaluate(() => {
          const box = document.getElementById('download')?.getBoundingClientRect()
          return box !== undefined && box.top < innerHeight && box.bottom > 0
        })
        if (closingOnScreen) await expect(pill(page)).toBeHidden()
        const covered = await page.evaluate(() => {
          const bar = document.querySelector('[data-download-pill]')
          if (!bar || getComputedStyle(bar).visibility === 'hidden') return []
          const a = bar.getBoundingClientRect()
          return [...document.querySelectorAll('#download a, body > footer a')]
            .filter((link) => {
              const b = link.getBoundingClientRect()
              return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
            })
            .map((link) => link.textContent?.trim())
        })
        expect(covered, `at ${y}`).toEqual([])
      }
    })
  })
}

test.describe('hero with reduced motion', () => {
  test.use({ viewport: desktop })

  test('shows final states: no entrance, an upright window that stays put, a drifting backdrop and the clip playing', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)

    // The backdrop's own slow drift is the one animation the hero keeps.
    const keyframes = await page.evaluate(() =>
      document
        .querySelector('#hero')
        ?.getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation instanceof CSSAnimation &&
            !(animation.effect as KeyframeEffect | null)?.target?.closest('.hero-backdrop'),
        )
        .map((animation) => (animation as CSSAnimation).animationName),
    )
    expect(keyframes).toEqual([])
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-backdrop-state', 'running')
    await expect(page.locator('.hero-rig')).toHaveCSS('transform', 'none')
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1')

    await scrollToY(page, 300)
    await frames(page, 3)
    await expect(page.locator('.hero-rig')).toHaveCSS('transform', 'none')
    await expect(page.locator('.hero-sky')).toHaveCSS('transform', 'none')
    await expect(page.locator('.hero-copy')).toHaveCSS('opacity', '1')
    expect(await heroVar(page, '--hero-settle')).toBe(1)
    const clip = page.locator('video[data-clip="hero"]')
    await expect
      .poll(() =>
        clip.evaluate((video: HTMLVideoElement) => !video.paused && video.currentTime > 0),
      )
      .toBe(true)
  })

  test('shows the pill without a transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPage(page)

    await scrollTo(page, 900)
    await expect(pill(page)).toBeVisible()
    const seconds = await pill(page).evaluate((element) =>
      getComputedStyle(element)
        .transitionDuration.split(',')
        .map((value) => parseFloat(value)),
    )
    expect(Math.max(...seconds)).toBeLessThan(0.001)
  })
})
